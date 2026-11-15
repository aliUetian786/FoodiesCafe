'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Table, TableStatus, normalizeBranchId } from '@/types/cafe';
import {
  X,
  Users,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Search,
  LayoutGrid,
  Utensils,
  RotateCcw,
  Plus,
  Trash2,
} from 'lucide-react';

interface AssignTablesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssignTablesModal: React.FC<AssignTablesModalProps> = ({ isOpen, onClose }) => {
  const {
    tables,
    updateTable,
    currentBranch,
    users,
    orders,
    assignWaiterToOrder,
    addToast,
    addTable,
    deleteTable,
  } = useApp();

  const [selectedFloor, setSelectedFloor] = useState<string>('All Floors');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddTableForm, setShowAddTableForm] = useState(false);
  const [newTableNum, setNewTableNum] = useState('');
  const [newTableCap, setNewTableCap] = useState(4);
  const [newTableFloor, setNewTableFloor] = useState('Ground Floor');

  // Branch tables
  const branchTables = useMemo(() => {
    const bId = normalizeBranchId(currentBranch.id);
    return tables.filter(
      (t) => !t.branchId || normalizeBranchId(t.branchId) === bId
    );
  }, [tables, currentBranch.id]);

  // Available Waiters / Floor Staff for this branch
  const availableWaiters = useMemo(() => {
    const bId = normalizeBranchId(currentBranch.id);
    const list = (users || []).filter((u) => {
      const isRole = u.role === 'floor_staff' || (u.role as string) === 'waiter';
      if (!isRole) return false;
      if (!bId || bId === 'all') return true;
      return !u.branchId || normalizeBranchId(u.branchId) === bId;
    });
    if (list.length === 0) {
      return (users || []).filter((u) => u.role === 'floor_staff' || (u.role as string) === 'waiter');
    }
    return list;
  }, [users, currentBranch.id]);

  // Unique floors
  const floors = useMemo(() => {
    const set = new Set<string>();
    branchTables.forEach((t) => {
      if (t.floor) set.add(t.floor);
    });
    return ['All Floors', ...Array.from(set)];
  }, [branchTables]);

  // Filtered tables by floor and search
  const filteredTables = useMemo(() => {
    return branchTables.filter((t) => {
      if (selectedFloor !== 'All Floors' && (t.floor || 'Ground Floor') !== selectedFloor) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = String(t.number).toLowerCase();
        const waiter = (t.assignedWaiterName || '').toLowerCase();
        const floor = (t.floor || '').toLowerCase();
        return num.includes(q) || waiter.includes(q) || floor.includes(q);
      }
      return true;
    });
  }, [branchTables, selectedFloor, searchQuery]);

  // Assignment stats
  const assignedCount = useMemo(() => {
    return branchTables.filter((t) => Boolean(t.assignedWaiterId || t.assignedWaiterName)).length;
  }, [branchTables]);

  const unassignedCount = branchTables.length - assignedCount;

  // Handle assign a single table
  const handleAssignWaiter = (tableId: string, waiterId: string) => {
    const targetTable = branchTables.find((t) => t.id === tableId);
    if (!targetTable) return;

    if (!waiterId) {
      // Unassign
      updateTable(tableId, {
        assignedWaiterId: '',
        assignedWaiterName: '',
      });

      // Clear active orders waiter assignment at this table
      const activeOrders = orders.filter(
        (o) =>
          o.type === 'dine_in' &&
          String(o.tableNumber) === String(targetTable.number) &&
          o.status !== 'completed' &&
          o.status !== 'cancelled'
      );
      activeOrders.forEach((o) => {
        assignWaiterToOrder(o.id, '', '');
      });

      addToast({
        type: 'info',
        title: 'Table Unassigned',
        message: `Table #${targetTable.number} is now unassigned.`,
      });
      return;
    }

    const waiter = availableWaiters.find((w) => w.id === waiterId) || users.find((u) => u.id === waiterId);
    const waiterName = waiter ? waiter.name : waiterId;

    updateTable(tableId, {
      assignedWaiterId: waiterId,
      assignedWaiterName: waiterName,
    });

    // Automatically sync active dine-in orders at this table to the assigned waiter
    const activeOrders = orders.filter(
      (o) =>
        o.type === 'dine_in' &&
        String(o.tableNumber) === String(targetTable.number) &&
        o.status !== 'completed' &&
        o.status !== 'cancelled'
    );
    activeOrders.forEach((o) => {
      assignWaiterToOrder(o.id, waiterId, waiterName);
    });

    addToast({
      type: 'success',
      title: 'Table Assigned ✓',
      message: `Table #${targetTable.number} assigned to ${waiterName}.`,
    });
  };

  // Quick auto-assign: Round-robin assign all unassigned tables to available waiters
  const handleAutoAssign = () => {
    if (availableWaiters.length === 0) {
      addToast({
        type: 'error',
        title: 'No Waiters Available',
        message: 'No floor staff accounts found for this branch.',
      });
      return;
    }

    let assignedNow = 0;
    branchTables.forEach((t, idx) => {
      if (!t.assignedWaiterId) {
        const waiter = availableWaiters[idx % availableWaiters.length];
        updateTable(t.id, {
          assignedWaiterId: waiter.id,
          assignedWaiterName: waiter.name,
        });

        // Also sync active dine-in orders at this table
        const activeOrders = orders.filter(
          (o) =>
            o.type === 'dine_in' &&
            String(o.tableNumber) === String(t.number) &&
            o.status !== 'completed' &&
            o.status !== 'cancelled'
        );
        activeOrders.forEach((o) => {
          assignWaiterToOrder(o.id, waiter.id, waiter.name);
        });

        assignedNow++;
      }
    });

    addToast({
      type: 'success',
      title: 'Auto-Assignment Complete ✓',
      message: `Assigned ${assignedNow} tables evenly among ${availableWaiters.length} staff members.`,
    });
  };

  // Reset all table assignments
  const handleClearAll = () => {
    branchTables.forEach((t) => {
      if (t.assignedWaiterId || t.assignedWaiterName) {
        updateTable(t.id, {
          assignedWaiterId: '',
          assignedWaiterName: '',
        });
      }
    });

    addToast({
      type: 'info',
      title: 'Assignments Cleared',
      message: 'All table assignments have been reset.',
    });
  };

  if (!isOpen) return null;

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return { bg: '#DCFCE7', text: '#15803D', label: 'Available' };
      case 'occupied':
        return { bg: '#FEE2E2', text: '#B91C1C', label: 'Occupied' };
      case 'reserved':
        return { bg: '#FEF3C7', text: '#B45309', label: 'Reserved' };
      case 'cleaning':
        return { bg: '#CFFAFE', text: '#0891B2', label: 'Cleaning' };
      default:
        return { bg: 'var(--bg-card-subtle)', text: 'var(--text-muted)', label: status };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '880px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 20px',
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
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} color="#2563EB" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 850, color: 'var(--text-main)' }}>
                  Assign Tables to Waiters / Floor Staff
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 750,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    border: '1px solid #BFDBFE',
                  }}
                >
                  {currentBranch.name}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Assigned tables and live dine-in orders automatically appear in that waiter&apos;s profile.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats & Quick Actions Toolbar */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            backgroundColor: 'var(--bg-card)',
            flexShrink: 0,
          }}
        >
          {/* Summary Pills */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 750,
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
              }}
            >
              Total Tables: <strong>{branchTables.length}</strong>
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 750,
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
              }}
            >
              Assigned: <strong>{assignedCount}</strong>
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 750,
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: unassignedCount > 0 ? '#FEF3C7' : 'var(--bg-card-subtle)',
                color: unassignedCount > 0 ? '#B45309' : 'var(--text-muted)',
              }}
            >
              Unassigned: <strong>{unassignedCount}</strong>
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 750,
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#EFF6FF',
                color: '#1E40AF',
              }}
            >
              Floor Staff: <strong>{availableWaiters.length}</strong>
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowAddTableForm(!showAddTableForm)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1.5px solid var(--primary)',
                backgroundColor: showAddTableForm ? 'var(--primary)' : 'rgba(234, 88, 12, 0.08)',
                color: showAddTableForm ? '#FFFFFF' : 'var(--primary)',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Plus size={13} />
              <span>{showAddTableForm ? 'Close Form' : '+ Add Table'}</span>
            </button>

            <button
              onClick={handleAutoAssign}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #BFDBFE',
                backgroundColor: '#EFF6FF',
                color: '#1E40AF',
                fontSize: '11.5px',
                fontWeight: 750,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Evenly distribute unassigned tables across active floor staff"
            >
              <Sparkles size={13} color="#2563EB" />
              <span>Auto-Assign Round-Robin</span>
            </button>

            {assignedCount > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RotateCcw size={12} />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Floor Filter Tabs & Search */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            backgroundColor: 'var(--bg-card)',
            flexShrink: 0,
          }}
        >
          {/* Floor tabs */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            {floors.map((flr) => (
              <button
                key={flr}
                onClick={() => setSelectedFloor(flr)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: selectedFloor === flr ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: selectedFloor === flr ? 'var(--primary)' : 'var(--bg-card-subtle)',
                  color: selectedFloor === flr ? '#FFFFFF' : 'var(--text-main)',
                  fontSize: '11.5px',
                  fontWeight: 750,
                  cursor: 'pointer',
                }}
              >
                {flr}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-full)',
              padding: '4px 10px',
              minWidth: '180px',
            }}
          >
            <Search size={13} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter table or waiter..."
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '12px',
                color: 'var(--text-main)',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* New Table Creation Form */}
        {showAddTableForm && (
          <div style={{ margin: '12px 20px', padding: '12px 14px', backgroundColor: 'var(--bg-card-subtle)', borderRadius: '10px', border: '1.5px solid var(--primary)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '10px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Table Number *</label>
              <input
                type="text"
                placeholder="e.g. 15 or T-15"
                value={newTableNum}
                onChange={(e) => setNewTableNum(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Chairs / Seats</label>
              <input
                type="number"
                min={1}
                max={30}
                value={newTableCap}
                onChange={(e) => setNewTableCap(Number(e.target.value) || 4)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Floor / Area</label>
              <input
                type="text"
                placeholder="e.g. Ground Floor"
                value={newTableFloor}
                onChange={(e) => setNewTableFloor(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 700 }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const trimmed = newTableNum.trim();
                if (!trimmed) {
                  addToast({
                    type: 'warning',
                    title: 'Table Number Required',
                    message: 'Please enter a valid table number.',
                  });
                  return;
                }
                const exists = branchTables.some(
                  (t) => String(t.number).toLowerCase() === trimmed.toLowerCase()
                );
                if (exists) {
                  addToast({
                    type: 'warning',
                    title: 'Table Already Exists',
                    message: `Table #${trimmed} already exists in this branch.`,
                  });
                  return;
                }
                addTable({
                  number: trimmed,
                  branchId: currentBranch.id,
                  floor: newTableFloor.trim() || 'Ground Floor',
                  capacity: Number(newTableCap) || 4,
                  chairs: Number(newTableCap) || 4,
                  status: 'available',
                });
                addToast({
                  type: 'success',
                  title: 'Table Created ✓',
                  message: `Table #${trimmed} has been created and is ready for service.`,
                });
                setNewTableNum('');
                setShowAddTableForm(false);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Save Table
            </button>
          </div>
        )}

        {/* Tables Grid Content */}
        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px',
            alignContent: 'start',
            boxSizing: 'border-box',
          }}
        >
          {filteredTables.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <LayoutGrid size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
              <div style={{ fontWeight: 700, fontSize: '14px' }}>No tables found</div>
              <p style={{ fontSize: '12px', margin: '4px 0 0' }}>Try picking another floor or clearing the search query.</p>
            </div>
          ) : (
            filteredTables.map((tbl) => {
              const status = getStatusColor(tbl.status);
              const isAssigned = Boolean(tbl.assignedWaiterId || tbl.assignedWaiterName);

              return (
                <div
                  key={tbl.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: isAssigned ? '1.5px solid #93C5FD' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Top line: Table Number & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 850, color: 'var(--text-main)' }}>
                        Table #{tbl.number}
                      </span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-card-subtle)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {tbl.chairs || tbl.capacity || 4} Seats
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: status.bg,
                          color: status.text,
                        }}
                      >
                        {status.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete Table #${tbl.number}? This will permanently remove it from the system.`)) {
                            deleteTable(tbl.id);
                            addToast({
                              type: 'info',
                              title: 'Table Deleted',
                              message: `Table #${tbl.number} was permanently removed.`,
                            });
                          }
                        }}
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: '#DC2626',
                          padding: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '4px',
                        }}
                        title={`Delete Table #${tbl.number}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Floor info */}
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Utensils size={12} />
                    <span>{tbl.floor || 'Ground Floor'}</span>
                  </div>

                  {/* Waiter Assignment Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Assigned Floor Staff:
                      </label>
                      {isAssigned && (
                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16A34A', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <CheckCircle2 size={11} /> Assigned
                        </span>
                      )}
                    </div>

                    <select
                      value={tbl.assignedWaiterId || ''}
                      onChange={(e) => handleAssignWaiter(tbl.id, e.target.value)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: isAssigned ? '1.5px solid #2563EB' : '1px dashed var(--border-color)',
                        backgroundColor: isAssigned ? '#EFF6FF' : 'var(--bg-input)',
                        color: isAssigned ? '#1E40AF' : 'var(--text-main)',
                        fontSize: '12px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        outline: 'none',
                        width: '100%',
                      }}
                    >
                      <option value="">-- Unassigned --</option>
                      {availableWaiters.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({(w.role as string) === 'waiter' ? 'Waiter' : 'Floor Staff'})
                        </option>
                      ))}
                      {/* Preserved custom assigned name if not in standard list */}
                      {tbl.assignedWaiterId && !availableWaiters.some((w) => w.id === tbl.assignedWaiterId) && (
                        <option value={tbl.assignedWaiterId}>
                          {tbl.assignedWaiterName || tbl.assignedWaiterId}
                        </option>
                      )}
                      {!tbl.assignedWaiterId && tbl.assignedWaiterName && (
                        <option value={tbl.assignedWaiterName}>{tbl.assignedWaiterName}</option>
                      )}
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-card-subtle)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Changes synchronize live across all staff screens and waiter profiles.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '7px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
