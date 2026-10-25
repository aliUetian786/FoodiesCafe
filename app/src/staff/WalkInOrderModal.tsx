'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, OrderItem } from '@/types/cafe';
import {
  UtensilsCrossed,
  Search,
  X,
  Plus,
  Minus,
  Utensils,
  ShoppingBag,
  Bike,
  Banknote,
  Clock,
  ChefHat,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface WalkInOrderModalProps {
  isOpen?: boolean;
  onClose: () => void;
  initialTableNumber?: string;
  defaultTableNumber?: string;
  isFloorStaff?: boolean;
  onOrderSuccess?: (order: Order) => void;
}

export const WalkInOrderModal: React.FC<WalkInOrderModalProps> = ({
  isOpen = true,
  onClose,
  initialTableNumber,
  defaultTableNumber,
  isFloorStaff: isFloorStaffProp,
  onOrderSuccess,
}) => {
  const {
    menuItems,
    currentBranch,
    currentUser,
    currentRole,
    tables,
    placeOrder,
    sendOrderToKitchen,
    recordCashPayment,
    addToast,
    updateTableStatus,
  } = useApp();

  const isFloorStaff = Boolean(isFloorStaffProp ?? (currentRole === 'floor_staff'));
  const effectiveInitialTable = initialTableNumber || defaultTableNumber;

  const [walkInStep, setWalkInStep] = useState<'menu' | 'checkout'>('menu');
  const [walkInSearch, setWalkInSearch] = useState('');
  const [walkInCategory, setWalkInCategory] = useState('All');
  const [walkInCart, setWalkInCart] = useState<OrderItem[]>([]);
  const [walkInOrderType, setWalkInOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [walkInTable, setWalkInTable] = useState<string>(effectiveInitialTable || '1');
  const [walkInCustomerName, setWalkInCustomerName] = useState('Walk-in Guest');
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState('+92 300 0000000');
  const [walkInDeliveryAddress, setWalkInDeliveryAddress] = useState('Gulberg III, Main Market, Lahore');
  const [walkInOrderNotes, setWalkInOrderNotes] = useState('');
  const [walkInPaymentChoice, setWalkInPaymentChoice] = useState<'paid' | 'unpaid'>('paid');

  // Available tables for Dine-In selection
  const branchTables = useMemo(() => {
    return tables.filter((t) => !t.branchId || t.branchId === currentBranch.id);
  }, [tables, currentBranch.id]);

  const availableTables = useMemo(() => {
    return branchTables.filter((t) => t.status === 'available' || t.number === initialTableNumber);
  }, [branchTables, initialTableNumber]);

  // Update table selection if initialTableNumber changes
  React.useEffect(() => {
    if (initialTableNumber) {
      setWalkInTable(initialTableNumber);
    } else if (availableTables.length > 0) {
      setWalkInTable(availableTables[0].number);
    }
  }, [initialTableNumber, availableTables]);

  // Cart operations
  const handleAddToCart = (item: any) => {
    setWalkInCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: `walkin-item-${Date.now()}-${item.id}`,
          menuItemId: item.id,
          name: item.name,
          unitPrice: Number(item.basePrice) || 0,
          quantity: 1,
          selectedAddOns: [],
          notes: '',
        },
      ];
    });
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setWalkInCart((prev) => {
      return prev
        .map((i) => {
          if (i.menuItemId === itemId) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as OrderItem[];
    });
  };

  const cartTotal = useMemo(() => {
    return walkInCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  }, [walkInCart]);

  const cartCount = useMemo(() => {
    return walkInCart.reduce((sum, i) => sum + i.quantity, 0);
  }, [walkInCart]);

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (walkInCategory !== 'All' && item.category !== walkInCategory) return false;
      if (walkInSearch.trim()) {
        const q = walkInSearch.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [menuItems, walkInCategory, walkInSearch]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((i) => set.add(i.category));
    return ['All', ...Array.from(set)];
  }, [menuItems]);

  // Dispatch walk-in order directly to kitchen
  const handleCreateWalkIn = () => {
    if (walkInCart.length === 0) {
      addToast({
        type: 'error',
        title: 'Order is Empty',
        message: 'Please add dishes from the menu to create a walk-in order.',
      });
      return;
    }

    const tablePin = tables.find(
      (t) => t.number === walkInTable && (!t.branchId || t.branchId === currentBranch.id)
    )?.pin;

    const actualOrderType = isFloorStaff ? 'dine_in' : walkInOrderType;

    const placed = placeOrder(
      actualOrderType,
      actualOrderType === 'dine_in' ? walkInTable : undefined,
      actualOrderType === 'dine_in' ? tablePin : undefined,
      actualOrderType === 'takeaway' ? 'Immediate walk-in counter collection' : undefined,
      actualOrderType === 'delivery' ? walkInDeliveryAddress : undefined,
      'Cash',
      walkInCart,
      {
        customerName: walkInCustomerName || 'Walk-in Guest',
        customerPhone: walkInCustomerPhone || '+92 300 0000000',
        cashierId: currentUser.id || 'staff-floor',
        cashierName: currentUser.name || 'Floor Staff Operative',
        isWalkIn: true,
        notes: walkInOrderNotes || `Walk-in order created by ${currentUser.name || 'Staff'}`,
      }
    );

    // DIRECT KITCHEN DISPATCH (No hold timer)
    sendOrderToKitchen(placed.id);

    // If paid now at till
    if (walkInPaymentChoice === 'paid') {
      recordCashPayment(placed.id, placed.total);
    }

    // If dine-in, mark table occupied in database
    if (walkInOrderType === 'dine_in' && walkInTable) {
      const tbl = branchTables.find((t) => t.number === walkInTable);
      if (tbl) {
        updateTableStatus(tbl.id, 'occupied');
      }
    }

    addToast({
      type: 'success',
      title: 'Dispatched Directly to Kitchen 👨‍🍳',
      message: `Walk-in Order #${placed.orderNumber} dispatched to kitchen queue. Status: COOKING.`,
    });

    onOrderSuccess?.(placed);
    onClose();
    setWalkInStep('menu');
    setWalkInCart([]);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: walkInStep === 'menu' ? '1060px' : '640px',
          width: '100%',
          maxHeight: '92vh',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative',
          transition: 'max-width 0.2s ease',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-card-subtle)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
            {isFloorStaff ? 'Table Order' : 'Walk-in Order'}
          </h3>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              color: 'var(--text-muted)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* STEP 1: INTERACTIVE MENU PAGE */}
        {walkInStep === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
            {/* Search & Category Tabs */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                backgroundColor: 'var(--bg-card)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-full)',
                  padding: '8px 16px',
                }}
              >
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  value={walkInSearch}
                  onChange={(e) => setWalkInSearch(e.target.value)}
                  placeholder="Search biryanis, karahi, burgers, kebabs, drinks..."
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                    width: '100%',
                  }}
                />
                {walkInSearch && (
                  <button
                    onClick={() => setWalkInSearch('')}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  paddingBottom: '2px',
                }}
              >
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setWalkInCategory(cat)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: walkInCategory === cat ? 'var(--primary)' : 'var(--bg-card-subtle)',
                      color: walkInCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                      border: walkInCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      fontSize: '12.5px',
                      fontWeight: walkInCategory === cat ? 800 : 600,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Dishes Grid */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px 20px 80px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '16px',
                alignContent: 'start',
              }}
            >
              {filteredMenuItems.map((item) => {
                const inCart = walkInCart.find((i) => i.menuItemId === item.id);
                const qty = inCart ? inCart.quantity : 0;

                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: 'var(--radius-lg)',
                      border: qty > 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ height: '110px', backgroundColor: 'var(--bg-card-subtle)', position: 'relative', overflow: 'hidden' }}>
                      <img
                        src={item.image || '/hero-bg.jpg'}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          backgroundColor: 'rgba(0,0,0,0.65)',
                          color: '#FFFFFF',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        {item.category}
                      </span>
                    </div>

                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)', lineHeight: 1.25 }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.3 }}>
                          {item.description.slice(0, 65)}...
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 850, color: 'var(--primary)' }}>
                          Rs. {Number(item.basePrice).toLocaleString()}
                        </span>

                        {qty > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-card-subtle)', padding: '3px 6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <button
                              onClick={() => handleUpdateQty(item.id, -1)}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Minus size={12} />
                            </button>
                            <span style={{ fontWeight: 850, fontSize: '13px', minWidth: '18px', textAlign: 'center' }}>
                              {qty}
                            </span>
                            <button
                              onClick={() => handleUpdateQty(item.id, 1)}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(item)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--primary)',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '12.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Plus size={14} />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom floating cart bar */}
            {cartCount > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '14px 20px',
                  backgroundColor: 'var(--bg-card)',
                  borderTop: '1px solid var(--border-color)',
                  boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  zIndex: 20,
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                    {cartCount} {cartCount === 1 ? 'item' : 'items'} selected
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary)' }}>
                    Total: Rs. {cartTotal.toLocaleString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setWalkInCart([])}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Clear All
                  </button>

                  <button
                    onClick={() => setWalkInStep('checkout')}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 850,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px var(--primary-glow)',
                    }}
                  >
                    <span>Proceed to Walk-in Checkout</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: FINALIZE WALK-IN CHECKOUT */}
        {walkInStep === 'checkout' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Back button */}
            <button
              onClick={() => setWalkInStep('menu')}
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} />
              <span>Back to Menu</span>
            </button>

            {/* Dine-In Table Selection (Walk-in is strictly Dine-In by default) */}
            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🍽️ Select Dine-In Table for Guest:
                </label>
                <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 750, backgroundColor: 'var(--primary-light)', padding: '2px 8px', borderRadius: '10px' }}>
                  Dine-In Seating Only
                </span>
              </div>
              {availableTables.length > 0 ? (
                <select
                  value={walkInTable}
                  onChange={(e) => setWalkInTable(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: '13.5px',
                    color: 'var(--text-main)',
                    fontWeight: 700,
                  }}
                >
                  {availableTables.map((t) => (
                    <option key={t.id} value={t.number}>
                      Table #{t.number} — Capacity: {t.capacity} Seats ({t.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ color: '#DC2626', fontSize: '12.5px', fontWeight: 700 }}>
                  ⚠️ No free tables currently available. Please free a table first.
                </div>
              )}
            </div>


            {/* Customer Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Customer Name:
                </label>
                <input
                  type="text"
                  value={walkInCustomerName}
                  onChange={(e) => setWalkInCustomerName(e.target.value)}
                  placeholder="Walk-in Guest"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Customer Mobile Phone:
                </label>
                <input
                  type="text"
                  value={walkInCustomerPhone}
                  onChange={(e) => setWalkInCustomerPhone(e.target.value)}
                  placeholder="+92 300 0000000"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            </div>

            {/* Order Notes */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Order Notes / Kitchen Instructions:
              </label>
              <input
                type="text"
                value={walkInOrderNotes}
                onChange={(e) => setWalkInOrderNotes(e.target.value)}
                placeholder="e.g. Mild spice, extra raita, rush order..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: '13px',
                  color: 'var(--text-main)',
                }}
              />
            </div>

            {/* Mode of Payment */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                {isFloorStaff ? 'Mode of Payment' : '2. Mode of Payment'}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <button
                  onClick={() => setWalkInPaymentChoice('paid')}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: walkInPaymentChoice === 'paid' ? '#DCFCE7' : 'var(--bg-card-subtle)',
                    border: walkInPaymentChoice === 'paid' ? '2px solid #16A34A' : '1px solid var(--border-color)',
                    color: walkInPaymentChoice === 'paid' ? '#166534' : 'var(--text-main)',
                    fontWeight: 800,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Banknote size={18} />
                  <span>Pay Cash Now (Paid)</span>
                </button>

                <button
                  onClick={() => setWalkInPaymentChoice('unpaid')}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: walkInPaymentChoice === 'unpaid' ? '#FEF3C7' : 'var(--bg-card-subtle)',
                    border: walkInPaymentChoice === 'unpaid' ? '2px solid #D97706' : '1px solid var(--border-color)',
                    color: walkInPaymentChoice === 'unpaid' ? '#92400E' : 'var(--text-main)',
                    fontWeight: 800,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Clock size={18} />
                  <span>Pay After Meal / At Till (Unpaid)</span>
                </button>
              </div>
            </div>

            {/* Direct Kitchen Notice */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#EFF6FF',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12px',
                color: '#1E40AF',
                fontWeight: 600,
              }}
            >
              <ChefHat size={20} color="#2563EB" style={{ flexShrink: 0 }} />
              <span>
                <strong>Direct Kitchen Dispatch:</strong> This walk-in order will dispatch directly to the kitchen queue without any wait timer.
              </span>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleCreateWalkIn}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                marginTop: '4px',
              }}
            >
              <ChefHat size={18} />
              <span>
                Dispatch Directly to Kitchen 👨‍🍳 (Rs. {cartTotal.toLocaleString()})
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
