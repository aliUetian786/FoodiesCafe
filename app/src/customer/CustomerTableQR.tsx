'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Table, TableStatus } from '@/types/cafe';
import {
  QrCode,
  CheckCircle,
  AlertOctagon,
  Users,
  KeyRound,
  ArrowRight,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface TableSelectionScreenProps {
  onNavigate: (view: string) => void;
}

export const TableSelectionScreen: React.FC<TableSelectionScreenProps> = ({ onNavigate }) => {
  const { currentBranch, tables, currentBranchId, updateTableStatus, addToast } = useApp();

  const branchTables = tables.filter((t) => t.branchId === currentBranchId);
  const [selectedTableId, setSelectedTableId] = useState<string>(branchTables[0]?.id || 't1');
  const [tablePinInput, setTablePinInput] = useState('');

  const currentTable = branchTables.find((t) => t.id === selectedTableId) || branchTables[0];

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return { bg: 'var(--table-available-bg)', text: 'var(--table-available-text)' };
      case 'reserved':
        return { bg: 'var(--table-reserved-bg)', text: 'var(--table-reserved-text)' };
      case 'occupied':
        return { bg: 'var(--table-occupied-bg)', text: 'var(--table-occupied-text)' };
      case 'cleaning':
        return { bg: 'var(--table-cleaning-bg)', text: 'var(--table-cleaning-text)' };
      default:
        return { bg: 'var(--table-unavailable-bg)', text: 'var(--table-unavailable-text)' };
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '24px auto 80px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Banner */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <QrCode size={16} />
          <span>Table QR Landing & Visual Grid</span>
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px', margin: 0 }}>
          Dine-in at {currentBranch.name}
        </h1>
        <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Simulate scanning any QR code by selecting a table below. See all 3 distinct states required by PRD!
        </p>
      </div>

      {/* Visual Table Grid */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Live Branch Table Grid
          </h3>

          {/* Color-coded Legend */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11.5px', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16A34A' }} /> Available
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#9333EA' }} /> Reserved
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#DC2626' }} /> Occupied
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#CA8A04' }} /> Cleaning
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748B' }} /> Out of Service
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
          {branchTables.map((t) => {
            const isSelected = t.id === currentTable?.id;
            const style = getStatusColor(t.status);
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTableId(t.id)}
                style={{
                  backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  padding: '14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transform: isSelected ? 'scale(1.04)' : 'none',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 14px var(--primary-glow)' : 'none',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>
                  {t.number}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t.capacity} Seats
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: style.bg,
                    color: style.text,
                    marginTop: '4px',
                  }}
                >
                  {t.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 DISTINCT QR LANDING STATES (PRD Requirement) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          padding: '36px 28px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          Simulated QR Scan View for: {currentTable?.number} ({currentBranch.name})
        </div>

        {/* STATE (A): TABLE AVAILABLE */}
        {currentTable?.status === 'available' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '440px', margin: '0 auto' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--table-available-bg)',
                color: 'var(--table-available-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle size={36} />
            </div>

            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Table {currentTable.number} is Available!
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                You are checked in for Dine-in service at {currentBranch.name}.
              </p>
            </div>

            {/* Optional On-table PIN */}
            <div style={{ width: '100%', backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'left' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <KeyRound size={14} color="var(--primary)" />
                <span>On-Table PIN (Optional anti-abuse check):</span>
              </label>
              <input
                type="text"
                placeholder={`Table PIN (e.g. ${currentTable.pin || '4921'})`}
                value={tablePinInput}
                onChange={(e) => setTablePinInput(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <button
              onClick={() => {
                addToast({
                  type: 'success',
                  title: `Seated at ${currentTable.number}`,
                  message: 'Table dining session initiated. Ready to order!',
                });
                onNavigate('menu');
              }}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 800,
                boxShadow: '0 4px 16px var(--primary-glow)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>Start Ordering Now</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STATE (B): TABLE RESERVED (Exact wording from PRD) */}
        {currentTable?.status === 'reserved' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '480px', margin: '0 auto' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--table-reserved-bg)',
                color: 'var(--table-reserved-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={36} />
            </div>

            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                This table is currently reserved
              </h2>
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                This table is reserved for another customer. Please choose an available table or ask our staff for assistance.
              </p>
            </div>

            {currentTable.reservedFor && (
              <div style={{ fontSize: '12px', color: 'var(--table-reserved-text)', backgroundColor: 'var(--table-reserved-bg)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                Held for: {currentTable.reservedFor}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '6px' }}>
              <button
                onClick={() => {
                  const firstAvail = branchTables.find((t) => t.status === 'available');
                  if (firstAvail) setSelectedTableId(firstAvail.id);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                }}
              >
                View available tables
              </button>

              <button
                onClick={() => onNavigate('support')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                }}
              >
                Ask staff
              </button>
            </div>
          </div>
        )}

        {/* STATE (C): TABLE OCCUPIED */}
        {currentTable?.status === 'occupied' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '440px', margin: '0 auto' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--table-occupied-bg)',
                color: 'var(--table-occupied-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertOctagon size={36} />
            </div>

            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Table {currentTable.number} is Occupied
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                An active dining session is currently in progress at this table ({currentTable.seatedAt || 'Customer seated'}).
              </p>
            </div>

            <button
              onClick={() => {
                const firstAvail = branchTables.find((t) => t.status === 'available');
                if (firstAvail) setSelectedTableId(firstAvail.id);
              }}
              style={{
                padding: '12px 24px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Select Another Available Table
            </button>
          </div>
        )}

        {/* CLEANING / UNAVAILABLE STATE */}
        {(currentTable?.status === 'cleaning' || currentTable?.status === 'unavailable') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', maxWidth: '440px', margin: '0 auto' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
              Table {currentTable.number} is {currentTable.status === 'cleaning' ? 'Being Cleaned & Sanitized' : 'Temporarily Unavailable'}
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              Our floor attendants are preparing this table. Please choose another table from the grid.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
