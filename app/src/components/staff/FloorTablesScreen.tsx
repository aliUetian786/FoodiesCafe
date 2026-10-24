'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Table, TableStatus } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  LayoutGrid,
  Users,
  CheckCircle,
  Clock,
  Sparkles,
  AlertOctagon,
  Calendar,
  Bell,
  RefreshCw,
} from 'lucide-react';

export const FloorTablesScreen: React.FC = () => {
  const { tables, currentBranchId, currentBranch, updateTableStatus, orders } = useApp();

  const [activeTab, setActiveTab] = useState<'grid' | 'reservations'>('grid');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [confirmFreeTableId, setConfirmFreeTableId] = useState<string | null>(null);

  const branchTables = tables.filter((t) => t.branchId === currentBranchId);
  const dineInOrders = orders.filter((o) => o.type === 'dine_in' && o.status !== 'completed' && o.status !== 'cancelled');

  const getStatusStyle = (status: TableStatus) => {
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

  const handleMarkFreeConfirmed = () => {
    if (!confirmFreeTableId) return;
    updateTableStatus(confirmFreeTableId, 'available');
    setConfirmFreeTableId(null);
    setSelectedTable(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Floor Staff — Live Table Management
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Branch: {currentBranch.name} · Live physical table status synchronization
          </p>
        </div>

        {/* Tab switch: Table Grid vs Reservations List */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('grid')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: activeTab === 'grid' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'grid' ? '#FFFFFF' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Live Table Grid
          </button>
          <button
            onClick={() => setActiveTab('reservations')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: activeTab === 'reservations' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'reservations' ? '#FFFFFF' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Reservations List (v1.1)
          </button>
        </div>
      </div>

      {activeTab === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
          {/* Main Table Grid */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                Dining Room Layout ({branchTables.length} Tables)
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tap table to update status</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
              {branchTables.map((tbl) => {
                const style = getStatusStyle(tbl.status);
                const isSelected = selectedTable?.id === tbl.id;

                return (
                  <div
                    key={tbl.id}
                    onClick={() => setSelectedTable(tbl)}
                    style={{
                      backgroundColor: 'var(--bg-card-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      padding: '16px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 4px 14px var(--primary-glow)' : 'none',
                      transition: 'transform 0.15s ease',
                      transform: isSelected ? 'scale(1.03)' : 'none',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-main)' }}>
                      {tbl.number}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {tbl.capacity} Guests
                    </div>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: style.bg,
                        color: style.text,
                      }}
                    >
                      {tbl.status}
                    </span>

                    {tbl.status === 'occupied' && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {tbl.seatedAt || 'Active'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Table Controls */}
            {selectedTable && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                      Selected: Table {selectedTable.number} (Current: {selectedTable.status.toUpperCase()})
                    </h4>
                    {selectedTable.reservedFor && (
                      <div style={{ fontSize: '12px', color: '#9333EA', fontWeight: 600 }}>
                        Reserved: {selectedTable.reservedFor}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => updateTableStatus(selectedTable.id, 'occupied')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--table-occupied-bg)',
                      color: 'var(--table-occupied-text)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Mark Seated / Occupied
                  </button>

                  <button
                    onClick={() => updateTableStatus(selectedTable.id, 'cleaning')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--table-cleaning-bg)',
                      color: 'var(--table-cleaning-text)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Mark Cleaning
                  </button>

                  {/* Mark Free requires Confirmation Popup (PRD Section F16) */}
                  <button
                    onClick={() => setConfirmFreeTableId(selectedTable.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--table-available-bg)',
                      color: 'var(--table-available-text)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Mark Table Free ✓
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Side Panel: Dine-in Orders Needing Service (PRD Requirement) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                Dine-in Orders Needing Service
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dineInOrders.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                  No pending dine-in requests
                </div>
              ) : (
                dineInOrders.map((ord) => (
                  <div
                    key={ord.id}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '14px' }}>
                        Table {ord.tableNumber || '?'}
                      </span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          backgroundColor: 'var(--status-preparing-bg)',
                          color: 'var(--status-preparing-text)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {ord.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Order #{ord.orderNumber} ({ord.items.length} items) · Total: Rs. {ord.total.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* RESERVATIONS LIST TAB (v1.1 PRD Requirement) */
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
            Time-Slot Table Bookings
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { id: 'res-1', guest: 'Mrs. Fatima Malik', table: 'T-02', time: '8:30 PM Tonight', party: '4 Guests', status: 'confirmed' },
              { id: 'res-2', guest: 'Dr. Arshad Beg', table: 'T-06', time: '9:00 PM Tonight', party: '8 Guests', status: 'requested' },
            ].map((res) => (
              <div
                key={res.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>{res.guest}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Table {res.table} · {res.time} · {res.party}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: 'var(--table-reserved-bg)',
                      color: 'var(--table-reserved-text)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {res.status}
                  </span>
                  <button
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Seat Guests
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal before Marking Table Free (PRD Section F16) */}
      <ModalConfirmation
        isOpen={!!confirmFreeTableId}
        onClose={() => setConfirmFreeTableId(null)}
        onConfirm={handleMarkFreeConfirmed}
        title="Mark Table Free?"
        message="Confirm that the table has been cleaned, sanitized, and is ready for new dine-in guests."
        confirmText="Yes, mark table free"
        cancelText="No, go back"
      />
    </div>
  );
};
