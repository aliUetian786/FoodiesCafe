'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, OrderItem, normalizeBranchId } from '@/types/cafe';
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
  ArrowLeft,
  ShoppingCart,
  Flame,
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
    addTable,
    deleteTable,
  } = useApp();

  const isFloorStaff = Boolean(isFloorStaffProp ?? (currentRole === 'floor_staff'));
  const effectiveInitialTable = initialTableNumber || defaultTableNumber;

  const [walkInStep, setWalkInStep] = useState<'menu' | 'checkout'>('menu');
  const [walkInSearch, setWalkInSearch] = useState('');
  const [walkInCategory, setWalkInCategory] = useState('Biryani & Rice');
  const [walkInCart, setWalkInCart] = useState<OrderItem[]>([]);
  const [walkInOrderType, setWalkInOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [walkInTable, setWalkInTable] = useState<string>(effectiveInitialTable || '1');
  const [showAddTableForm, setShowAddTableForm] = useState(false);
  const [newTableNum, setNewTableNum] = useState('');
  const [newTableCap, setNewTableCap] = useState(4);
  const [newTableFloor, setNewTableFloor] = useState('Ground Floor');
  const [walkInCustomerName, setWalkInCustomerName] = useState('Walk-in Guest');
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState('+92 300 0000000');
  const [walkInDeliveryAddress, setWalkInDeliveryAddress] = useState('Gulberg III, Main Market, Lahore');
  const [walkInOrderNotes, setWalkInOrderNotes] = useState('');
  const [walkInPaymentChoice, setWalkInPaymentChoice] = useState<'paid' | 'unpaid'>('paid');

  const categories = useMemo(() => {
    return [
      'Biryani & Rice',
      'Karahi & Handi',
      'Burgers & Fast Food',
      'BBQ & Kebabs',
      'Tandoor & Breads',
      'Beverages & Desserts',
    ];
  }, []);

  const menuScrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryRowRef = useRef<HTMLDivElement>(null);
  const categoryBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isManualScrollRef = useRef(false);

  const isItemInCategory = (itemCat: string, selectedCat: string) => {
    if (itemCat === selectedCat) return true;
    const i = (itemCat || '').toLowerCase();
    const s = (selectedCat || '').toLowerCase();
    if (s.includes('biryani') && i.includes('biryani')) return true;
    if (s.includes('karahi') && (i.includes('karahi') || i.includes('handi') || i.includes('shinwari'))) return true;
    if (s.includes('burger') && (i.includes('burger') || i.includes('fast food'))) return true;
    if (s.includes('bbq') && (i.includes('bbq') || i.includes('kebab') || i.includes('tikka') || i.includes('chops'))) return true;
    if ((s.includes('tandoor') || s.includes('bread')) && (i.includes('bread') || i.includes('naan') || i.includes('tandoor') || i.includes('roti'))) return true;
    if ((s.includes('beverage') || s.includes('dessert') || s.includes('drink')) && (i.includes('beverage') || i.includes('dessert') || i.includes('drink') || i.includes('chai') || i.includes('kheer') || i.includes('jamun'))) return true;
    return false;
  };

  const handleCategoryClick = (cat: string) => {
    setWalkInCategory(cat);
    isManualScrollRef.current = true;
    const targetEl = document.getElementById(`walkin-cat-${encodeURIComponent(cat)}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      isManualScrollRef.current = false;
    }, 750);
  };

  // Scrollspy & keep active category button in view
  useEffect(() => {
    if (!walkInCategory) return;
    const btn = categoryBtnRefs.current[walkInCategory];
    const row = categoryRowRef.current;
    if (btn && row) {
      const scrollLeftTarget = btn.offsetLeft - row.offsetWidth / 2 + btn.offsetWidth / 2;
      row.scrollTo({
        left: Math.max(0, scrollLeftTarget),
        behavior: 'smooth',
      });
    }
  }, [walkInCategory]);

  const handleMenuContainerScroll = () => {
    if (isManualScrollRef.current) return;
    if (walkInSearch.trim()) return;
    const container = menuScrollContainerRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    let activeCat = categories[0];
    for (const cat of categories) {
      const el = document.getElementById(`walkin-cat-${encodeURIComponent(cat)}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerTop <= 160) {
          activeCat = cat;
        }
      }
    }
    setWalkInCategory(activeCat);
  };

  // Available tables for Dine-In selection
  const normBranchId = normalizeBranchId(currentBranch.id);
  const branchTables = useMemo(() => {
    return tables.filter(
      (t) => !t.branchId || t.branchId === currentBranch.id || normalizeBranchId(t.branchId) === normBranchId
    );
  }, [tables, currentBranch.id, normBranchId]);

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
    const effectivePrice = (currentBranch && item.branchPriceOverrides?.[currentBranch.id] !== undefined && Number(item.branchPriceOverrides[currentBranch.id]) > 0)
      ? Number(item.branchPriceOverrides[currentBranch.id])
      : (Number(item.basePrice) || 0);

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
          unitPrice: effectivePrice,
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

  // Filtered search results when searching
  const filteredSearchResults = useMemo(() => {
    if (!walkInSearch.trim()) return [];
    const q = walkInSearch.toLowerCase().trim();
    return menuItems.filter((item) => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchCat = item.category?.toLowerCase().includes(q);
      return matchName || matchDesc || matchCat;
    });
  }, [menuItems, walkInSearch]);

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

    const targetTableObj = branchTables.find((t) => t.number === walkInTable);
    const walkInWaiterId = isFloorStaff
      ? currentUser.id
      : (targetTableObj?.assignedWaiterId || (currentRole === 'floor_staff' ? currentUser.id : undefined));
    const walkInWaiterName = isFloorStaff
      ? currentUser.name
      : (targetTableObj?.assignedWaiterName || (currentRole === 'floor_staff' ? currentUser.name : undefined));

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
        assignedWaiterId: walkInWaiterId,
        assignedWaiterName: walkInWaiterName,
      }
    );

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

    // Dispatch directly to kitchen queue immediately (bypassing any hold timer)
    sendOrderToKitchen(placed.id);

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

  const renderItemCard = (item: any) => {
    const inCart = walkInCart.find((i) => i.menuItemId === item.id);
    const qty = inCart ? inCart.quantity : 0;
    const isAvailAtBranch = (item.branchAvailability?.[currentBranch.id] !== false && item.isAvailable !== false);
    const effectivePrice = (currentBranch && item.branchPriceOverrides?.[currentBranch.id] !== undefined && Number(item.branchPriceOverrides[currentBranch.id]) > 0)
      ? Number(item.branchPriceOverrides[currentBranch.id])
      : (Number(item.basePrice) || 0);

    return (
      <div
        key={item.id}
        onClick={isAvailAtBranch ? () => handleAddToCart(item) : undefined}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: qty > 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)',
          cursor: isAvailAtBranch ? 'pointer' : 'default',
          opacity: isAvailAtBranch ? 1 : 0.6,
          filter: isAvailAtBranch ? 'none' : 'grayscale(60%)',
          transition: 'transform 0.12s ease',
        }}
      >
        <div style={{ height: '130px', backgroundColor: 'var(--bg-card-subtle)', position: 'relative', overflow: 'hidden' }}>
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
              backdropFilter: 'blur(4px)',
              color: '#FFFFFF',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 750,
            }}
          >
            {item.category}
          </span>
          {!isAvailAtBranch && (
            <span
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                backgroundColor: 'rgba(220, 38, 38, 0.85)',
                color: '#FFFFFF',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 800,
              }}
            >
              OUT OF STOCK
            </span>
          )}
        </div>

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)', lineHeight: 1.3, fontFamily: "'Outfit', sans-serif" }}>
              {item.name}
            </div>
            {item.description && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.description}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--primary)' }}>
              Rs. {effectivePrice.toLocaleString()}
            </span>

            {!isAvailAtBranch ? (
              <span style={{ fontSize: '11px', fontWeight: 750, color: '#DC2626' }}>
                Unavailable
              </span>
            ) : qty > 0 ? (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--primary)',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateQty(item.id, -1);
                  }}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Minus size={11} />
                </button>
                <span style={{ fontWeight: 850, fontSize: '12.5px', minWidth: '18px', textAlign: 'center', color: 'var(--primary)' }}>
                  {qty}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateQty(item.id, 1);
                  }}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(item);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px var(--primary-glow)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus size={13} strokeWidth={2.4} />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {walkInStep === 'checkout' && (
              <button
                onClick={() => setWalkInStep('menu')}
                style={{
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="Back to Menu"
                aria-label="Back to Menu"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
              {walkInStep === 'checkout'
                ? 'Order Checkout'
                : isFloorStaff ? 'Table Order' : 'Walk-in Order'}
            </h3>
          </div>

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
                ref={categoryRowRef}
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
                    ref={(el) => {
                      categoryBtnRefs.current[cat] = el;
                    }}
                    onClick={() => handleCategoryClick(cat)}
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

            {/* Dishes Container: Continuous Category Scroll Matching Customer Menu */}
            <div
              ref={menuScrollContainerRef}
              onScroll={handleMenuContainerScroll}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px 20px 95px',
                display: 'flex',
                flexDirection: 'column',
                gap: '28px',
              }}
            >
              {walkInSearch.trim() ? (
                <div>
                  <div style={{ marginBottom: '14px', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Search Results for &ldquo;{walkInSearch}&rdquo; ({filteredSearchResults.length} {filteredSearchResults.length === 1 ? 'dish' : 'dishes'} found)
                  </div>
                  {filteredSearchResults.length === 0 ? (
                    <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                      No dishes found matching &ldquo;{walkInSearch}&rdquo;.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                        gap: '16px',
                        alignContent: 'start',
                      }}
                    >
                      {filteredSearchResults.map((item) => renderItemCard(item))}
                    </div>
                  )}
                </div>
              ) : (
                categories.map((cat) => {
                  const catItems = menuItems.filter((item) => isItemInCategory(item.category, cat));
                  if (catItems.length === 0) return null;

                  return (
                    <section
                      key={cat}
                      id={`walkin-cat-${encodeURIComponent(cat)}`}
                      style={{
                        scrollMarginTop: '12px',
                      }}
                    >
                      {/* Category Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingBottom: '10px',
                          marginBottom: '16px',
                          borderBottom: '2px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--primary-glow)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Flame size={17} />
                          </span>
                          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                            {cat}
                          </h3>
                        </div>

                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg-card-subtle)',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {catItems.length} {catItems.length === 1 ? 'Dish' : 'Dishes'}
                        </span>
                      </div>

                      {/* Grid of Dishes for this Category */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                          gap: '16px',
                          alignContent: 'start',
                        }}
                      >
                        {catItems.map((item) => renderItemCard(item))}
                      </div>
                    </section>
                  );
                })
              )}
            </div>

            {/* Bottom floating cart bar */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '12px 18px',
                backgroundColor: 'var(--bg-card)',
                borderTop: '1px solid var(--border-color)',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 20,
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: cartCount > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                  {cartCount} {cartCount === 1 ? 'item' : 'items'} selected
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: cartCount > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                  Total: Rs. {cartTotal.toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {cartCount > 0 && (
                  <button
                    onClick={() => setWalkInCart([])}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Clear All
                  </button>
                )}

                <button
                  disabled={cartCount === 0}
                  onClick={() => setWalkInStep('checkout')}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: cartCount > 0 ? 'var(--primary)' : 'var(--bg-card-subtle)',
                    color: cartCount > 0 ? '#FFFFFF' : 'var(--text-muted)',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 850,
                    cursor: cartCount > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: cartCount > 0 ? '0 4px 12px var(--primary-glow)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: FINALIZE WALK-IN CHECKOUT */}
        {walkInStep === 'checkout' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Selected Dishes Review */}
            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Selected Dishes ({cartCount} {cartCount === 1 ? 'item' : 'items'})
                </h4>
                <button
                  onClick={() => setWalkInStep('menu')}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--primary)',
                    fontSize: '12.5px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                  }}
                >
                  <Plus size={13} />
                  <span>+ Add More Items</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {walkInCart.map((it) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '2px 7px', borderRadius: '4px', fontSize: '12px' }}>
                        {it.quantity}x
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{it.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                        Rs. {(it.unitPrice * it.quantity).toLocaleString()}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => handleUpdateQty(it.menuItemId, -1)}
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleUpdateQty(it.menuItemId, 1)}
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 800 }}>Total Order Bill:</span>
                <span style={{ fontSize: '17px', fontWeight: 900, color: 'var(--primary)' }}>
                  Rs. {cartTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Dine-In Table Selection (Walk-in is strictly Dine-In by default) */}
            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🍽️ Select Dine-In Table for Guest:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddTableForm(!showAddTableForm)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--primary)',
                      backgroundColor: showAddTableForm ? 'var(--primary)' : 'rgba(234, 88, 12, 0.08)',
                      color: showAddTableForm ? '#FFFFFF' : 'var(--primary)',
                      fontSize: '11px',
                      fontWeight: 750,
                      cursor: 'pointer',
                    }}
                  >
                    {showAddTableForm ? 'Close' : '+ Add Table'}
                  </button>
                  {branchTables.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = branchTables.find((t) => t.number === walkInTable);
                        if (!target) return;
                        if (confirm(`Delete Table #${target.number}? This will permanently remove it from floor layout.`)) {
                          deleteTable(target.id);
                          const remaining = branchTables.filter((t) => t.id !== target.id);
                          if (remaining.length > 0) {
                            setWalkInTable(remaining[0].number);
                          }
                        }
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid #EF4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        color: '#DC2626',
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                      }}
                      title="Permanently delete this table"
                    >
                      🗑️ Delete Table
                    </button>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 750, backgroundColor: 'var(--primary-light)', padding: '2px 8px', borderRadius: '10px' }}>
                    Dine-In Seating
                  </span>
                </div>
              </div>
              <select
                value={walkInTable}
                onChange={(e) => setWalkInTable(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1.5px solid var(--primary)',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: '13.5px',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                }}
              >
                {branchTables.map((t) => (
                  <option key={t.id} value={t.number}>
                    Table #{t.number} — Capacity: {t.capacity} Guests ({t.status.toUpperCase()})
                  </option>
                ))}
              </select>

              {showAddTableForm && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '8px', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Table #</label>
                    <input
                      type="text"
                      placeholder="e.g. 15"
                      value={newTableNum}
                      onChange={(e) => setNewTableNum(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Chairs</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={newTableCap}
                      onChange={(e) => setNewTableCap(Number(e.target.value) || 4)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Floor</label>
                    <input
                      type="text"
                      value={newTableFloor}
                      onChange={(e) => setNewTableFloor(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newTableNum.trim()) return;
                      addTable({
                        number: newTableNum.trim(),
                        branchId: currentBranch.id,
                        floor: newTableFloor.trim() || 'Ground Floor',
                        capacity: Number(newTableCap) || 4,
                        chairs: Number(newTableCap) || 4,
                        status: 'available',
                      });
                      setWalkInTable(newTableNum.trim());
                      setNewTableNum('');
                      setShowAddTableForm(false);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 750,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Save Table
                  </button>
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

            {/* Submit Button */}
            <button
              onClick={handleCreateWalkIn}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 850,
                cursor: 'pointer',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px var(--primary-glow)',
                marginTop: '4px',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Proceed</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
