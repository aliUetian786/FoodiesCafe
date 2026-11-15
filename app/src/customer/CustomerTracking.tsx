'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, OrderItem, MenuItem, getCancellationAttribution } from '@/types/cafe';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Plus,
  Minus,
  Trash2,
  X,
  Printer,
  Navigation,
  Calendar,
  Search,
  Sparkles,
  ArrowRight,
  ShoppingBag,
  Map as MapIcon,
} from 'lucide-react';
import { CustomerLoginModal } from './CustomerLoginModal';
import { OpenStreetMapView } from '@/components/common/OpenStreetMapView';
import { calculateHaversineKm, getOsmDirectionsUrl } from '@/utils/openStreetMap';

interface OrderTrackingScreenProps {
  onNavigate: (view: string) => void;
}

function parseDateSafe(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  const spaceReplaced = new Date(dateStr.replace(' ', 'T'));
  if (!isNaN(spaceReplaced.getTime())) return spaceReplaced;
  return null;
}

function parseOrderTimeMs(dateStr?: string): number {
  if (!dateStr) return 0;
  const d = parseDateSafe(dateStr);
  return d ? d.getTime() : 0;
}

function formatPlacedTime(dateStr?: string): string {
  if (!dateStr) return 'Just now';
  const d = parseDateSafe(dateStr);
  if (!d) {
    const match = dateStr.match(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/);
    if (match) return match[0];
    const parts = dateStr.split(',');
    return parts.length > 1 ? parts[1].trim() : dateStr;
  }
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minutePadded = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hour12 < 10 ? '0' : ''}${hour12}:${minutePadded} ${ampm}`;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({ onNavigate }) => {
  const {
    orders,
    cancelOrder,
    editOrderStage1,
    menuItems,
    addToast,
    branches,
    currentBranch,
    currentUser,
    customerCoordinates,
  } = useApp();

  const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
  const cleanPhone = normalizePhone(currentUser?.phone);

  const isCustomerLoggedIn = Boolean(
    currentUser &&
    currentUser.name &&
    currentUser.name !== 'Guest Customer' &&
    currentUser.role === 'customer' &&
    currentUser.id !== 'user-guest' &&
    currentUser.id !== 'guest'
  );

  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Multi-source fallback customer order discovery (only when logged in)
  const customerOrders = useMemo(() => {
    if (!isCustomerLoggedIn) {
      return [];
    }

    let localPlacedIds: string[] = [];
    let localCachedOrders: Order[] = [];
    if (typeof window !== 'undefined') {
      try {
        localPlacedIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
        localCachedOrders = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
      } catch (e) {}
    }

    const pool = [...orders];
    localCachedOrders.forEach((co) => {
      const idx = pool.findIndex((o) => o.id === co.id || o.orderNumber === co.orderNumber);
      if (idx === -1) {
        pool.push(co);
      } else {
        if (co.status === 'cancelled' && pool[idx].status !== 'cancelled') {
          pool[idx] = { ...pool[idx], status: 'cancelled' };
        }
      }
    });

    return pool.filter((o) => {
      // 1. Customer ID match
      if (currentUser?.id && currentUser.id !== 'user-guest' && o.customerId === currentUser.id) return true;
      // 2. Email match
      if (currentUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === currentUser.email.toLowerCase()) return true;
      // 3. Customer name match if authenticated
      if (currentUser?.name && currentUser.name !== 'Guest Customer' && o.customerName === currentUser.name) return true;
      // 4. Phone match
      if (cleanPhone && normalizePhone(o.customerPhone) === cleanPhone) return true;
      // 5. Placed on this device/browser
      if (localPlacedIds.includes(o.id) || localPlacedIds.includes(o.orderNumber)) return true;
      return false;
    });
  }, [orders, cleanPhone, currentUser, isCustomerLoggedIn]);

  // All active in-progress orders remain in tracking until confirmed received/completed
  // List new orders in tracking at the very top (sorted strictly by createdAt descending)
  const activeOrders = useMemo(() => {
    return customerOrders
      .filter(
        (o) =>
          o.status !== 'completed' &&
          o.status !== 'delivered' &&
          o.status !== 'served' &&
          o.status !== 'taken' &&
          o.status !== 'cancelled'
      )
      .sort((a, b) => parseOrderTimeMs(b.createdAt) - parseOrderTimeMs(a.createdAt));
  }, [customerOrders]);

  const cancelledOrders = useMemo(() => {
    return customerOrders
      .filter((o) => o.status === 'cancelled')
      .sort((a, b) => parseOrderTimeMs(b.createdAt) - parseOrderTimeMs(a.createdAt));
  }, [customerOrders]);

  // Edit / Add Items Modal State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [currentDishes, setCurrentDishes] = useState<OrderItem[]>([]);
  const [addedMoreCounts, setAddedMoreCounts] = useState<Record<string, number>>({});
  const [searchDishQuery, setSearchDishQuery] = useState('');
  const [selectedAddCategory, setSelectedAddCategory] = useState<string>('All');

  // Cancel Confirmation Modal State
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  // 80mm Thermal Receipt Pop-up Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<Order | null>(null);
  const [receiptPrintTime, setReceiptPrintTime] = useState<string>('');
  const [expandedMapOrderId, setExpandedMapOrderId] = useState<string | null>(null);

  // Format branch name strictly into 2 words e.g. "Gulberg Branch"
  const getBranchTwoWords = (name: string): string => {
    const clean = (name || '').replace(/\s*\(.*?\)/g, '').trim();
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      if (words[1].toLowerCase() === 'branch') {
        return `${words[0]} ${words[1]}`;
      }
      const branchIdx = words.findIndex((w) => w.toLowerCase() === 'branch');
      if (branchIdx !== -1) {
        return `${words[0]} Branch`;
      }
      return `${words[0]} ${words[1]}`;
    }
    return `${clean} Branch`;
  };

  // Distinct categories for "Add More" section in edit modal
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return ['All', ...Array.from(set)];
  }, [menuItems]);

  // Dishes available to add in "Add More": exclude items that are already in editingOrder.items
  const addMoreDishes = useMemo(() => {
    if (!editingOrder) return menuItems;
    let list = menuItems.filter(
      (dish) =>
        !editingOrder.items.some(
          (orig) =>
            orig.menuItemId === dish.id ||
            orig.name.toLowerCase() === dish.name.toLowerCase()
        )
    );
    if (selectedAddCategory && selectedAddCategory !== 'All') {
      list = list.filter((d) => d.category === selectedAddCategory);
    }
    if (searchDishQuery.trim()) {
      const q = searchDishQuery.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
    }
    return list;
  }, [menuItems, editingOrder, selectedAddCategory, searchDishQuery]);

  // Unauthenticated State: zero orders displayed, clean sign-in prompt
  if (!isCustomerLoggedIn) {
    return (
      <div
        className="foodies-tracking-empty-view"
        style={{
          maxWidth: '640px',
          margin: '70px auto',
          textAlign: 'center',
          padding: '0 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            backgroundColor: 'rgba(217, 101, 40, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
          }}
        >
          <ShoppingBag size={40} color="var(--primary)" />
        </div>
        <h2
          style={{
            fontSize: '26px',
            fontWeight: 850,
            color: 'var(--text-main)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Sign In to Track Orders
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            marginTop: '10px',
            maxWidth: '460px',
            lineHeight: 1.6,
            fontSize: '14.5px',
          }}
        >
          Please sign in with your email to view your active orders and track live preparation status.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '14px',
            marginTop: '26px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setLoginModalOpen(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              fontWeight: 750,
              fontSize: '14px',
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 4px 14px var(--primary-glow)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Sign In with Email</span>
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => onNavigate('menu')}
            style={{
              padding: '12px 22px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              border: '1.5px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 750,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <ShoppingBag size={16} />
            <span>Browse Menu</span>
            <ArrowRight size={15} />
          </button>
        </div>

        <CustomerLoginModal
          isOpen={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          onSuccess={() => {
            setLoginModalOpen(false);
            onNavigate('home');
          }}
        />
      </div>
    );
  }

  // Empty State: All orders received or no active tracking orders
  if (activeOrders.length === 0) {
    const mostRecentCancelled = cancelledOrders.length > 0 ? cancelledOrders[0] : null;
    const cancelAttr = mostRecentCancelled ? getCancellationAttribution(mostRecentCancelled) : null;

    return (
      <div className="foodies-tracking-empty-view" style={{ maxWidth: '640px', margin: '60px auto', textAlign: 'center', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {mostRecentCancelled && cancelAttr && (
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              padding: '16px 18px',
              borderRadius: '16px',
              backgroundColor: '#FEF2F2',
              border: '1.5px solid #FCA5A5',
              marginBottom: '24px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: 800, fontSize: '14px' }}>
              <AlertTriangle size={18} />
              <span>
                Order #{mostRecentCancelled.orderNumber}{' '}
                {cancelAttr.isCustomer
                  ? 'Cancelled by You'
                  : cancelAttr.badge === 'CANCELLED (BRANCH CLOSED)'
                    ? 'Cancelled (Branch Closed Offline)'
                    : 'Cancelled by Staff'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#7F1D1D', lineHeight: 1.5 }}>
              {cancelAttr.isCustomer
                ? 'You cancelled this order. All records and receipts are saved permanently in your Order History.'
                : cancelAttr.badge === 'CANCELLED (BRANCH CLOSED)'
                  ? 'This order was removed from active tracking because the branch was closed offline by staff prior to receipt. All records and receipts are saved permanently in your Order History.'
                  : 'This order was cancelled by cafe staff prior to receipt. All records and receipts are saved permanently in your Order History.'}
            </p>
          </div>
        )}

        <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
          <CheckCircle2 size={42} color="#16A34A" />
        </div>
        <h2 style={{ fontSize: '26px', fontWeight: 850, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
          All Orders Received!
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '10px', maxWidth: '460px', lineHeight: 1.6, fontSize: '14.5px' }}>
          You have no pending in-progress orders. All past orders and receipts are saved permanently in your Order History.
        </p>
        <div style={{ display: 'flex', gap: '14px', marginTop: '26px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => onNavigate('history')}
            style={{
              padding: '12px 22px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--primary)',
              border: '1.5px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 750,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <Receipt size={16} />
            <span>View Order History</span>
            <ArrowRight size={15} />
          </button>
          <button
            onClick={() => onNavigate('menu')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              fontWeight: 750,
              fontSize: '14px',
              cursor: 'pointer',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px var(--primary-glow)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Browse Menu & Order</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  const handleOpenDirections = (ord: Order) => {
    const orderBranch = branches.find((b) => b.id === ord.branchId) || currentBranch;
    const branchCoords = {
      lat: Number(orderBranch?.latitude) || 31.5204,
      lng: Number(orderBranch?.longitude) || 74.3587,
    };

    if (ord.type !== 'delivery') {
      const gUrl = `https://www.google.com/maps/search/?api=1&query=${branchCoords.lat},${branchCoords.lng}`;
      window.open(gUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const destCoords =
      ord.type === 'delivery' && ord.customerCoordinates
        ? ord.customerCoordinates
        : branchCoords;
    const originCoords =
      ord.type === 'delivery'
        ? branchCoords
        : customerCoordinates || undefined;

    const url = getOsmDirectionsUrl(originCoords, destCoords);
    window.open(url, '_blank');
  };

  // Open Edit / Add Items Modal for a specific order
  const handleOpenEditItems = (ord: Order) => {
    setEditingOrder(ord);
    setCurrentDishes(
      ord.items.map((i) => ({
        ...i,
        quantity: i.quantity || 1,
        unitPrice: Number(i.unitPrice) || 0,
      }))
    );
    setAddedMoreCounts({});
    setSearchDishQuery('');
    setSelectedAddCategory('All');
  };

  // Stepper for Current Dishes (already selected items)
  const handleEditCurrentQty = (itemId: string, delta: number) => {
    const isPrepOrReady = editingOrder?.status === 'preparing' || editingOrder?.status === 'ready';
    if (isPrepOrReady && delta < 0) {
      addToast({
        type: 'warning',
        title: 'Action Locked',
        message: 'Items already preparing in kitchen cannot be removed or reduced.',
      });
      return;
    }
    setCurrentDishes((prev) =>
      prev
        .map((it) => (it.id === itemId ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
    );
  };

  // Stepper for Add More (newly added items stay right in Add More)
  const handleStepAddMore = (dishId: string, delta: number) => {
    setAddedMoreCounts((prev) => {
      const curr = prev[dishId] || 0;
      const next = Math.max(0, curr + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[dishId];
        return copy;
      }
      return { ...prev, [dishId]: next };
    });
  };

  // Confirm changes from Edit Modal
  const handleSaveEditItems = () => {
    if (!editingOrder) return;
    const activeCurrent = currentDishes.filter((i) => i.quantity > 0);
    const fromAddMore: OrderItem[] = Object.entries(addedMoreCounts)
      .filter(([_, qty]) => qty > 0)
      .map(([dishId, qty], idx) => {
        const dish = menuItems.find((m) => m.id === dishId);
        return {
          id: `add-${dishId}-${Date.now()}-${idx}`,
          menuItemId: dishId,
          name: dish ? dish.name : 'Foodies Special Dish',
          unitPrice: dish ? Number(dish.basePrice) : 0,
          quantity: qty,
          isAddOn: true,
          addedAtStage: 'stage2',
        };
      });

    const combined = [...activeCurrent, ...fromAddMore];

    if (combined.length === 0) {
      cancelOrder(editingOrder.id, 'All items deselected from order by customer');
      addToast({
        type: 'info',
        title: 'Order Cancelled',
        message: `Order #${editingOrder.orderNumber} cancelled and moved to Order History`,
      });
      setEditingOrder(null);
      return;
    }

    editOrderStage1(editingOrder.id, combined);
    addToast({
      type: 'success',
      title: 'Order Updated! 🍳',
      message: `Items updated for Order #${editingOrder.orderNumber} and sent to kitchen.`,
    });
    setEditingOrder(null);
  };

  // Confirm order cancellation: moves order to History
  const handleConfirmCancelOrder = () => {
    if (!cancellingOrder) return;
    const targetId = cancellingOrder.id;
    const targetNum = cancellingOrder.orderNumber;
    cancelOrder(targetId, 'Cancelled by customer');

    if (typeof window !== 'undefined') {
      try {
        const rawCache = localStorage.getItem('foodies_customer_history_cache');
        if (rawCache) {
          const list: Order[] = JSON.parse(rawCache);
          const updated = list.map((o) =>
            o.id === targetId || o.orderNumber === targetNum
              ? {
                  ...o,
                  status: 'cancelled' as const,
                  notes: 'Cancelled by customer',
                  cancellationReason: 'Cancelled by customer',
                  cancelledBy: 'customer' as const,
                }
              : o
          );
          localStorage.setItem('foodies_customer_history_cache', JSON.stringify(updated));
        }
      } catch (e) {}
    }

    addToast({
      type: 'info',
      title: 'Order Cancelled',
      message: `Order #${cancellingOrder.orderNumber} cancelled and moved to Order History`,
    });
    setCancellingOrder(null);
  };

  // Thermal slip print action using clean hidden iframe
  const handlePrintSlip = (ord: Order) => {
    const liveTime = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const liveDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timestampStr = `${liveDate} at ${liveTime}`;
    setReceiptPrintTime(timestampStr);

    const existingIframe = document.getElementById('foodies-tracking-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'foodies-tracking-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const orderBranch = branches.find((b) => b.id === ord.branchId) || currentBranch;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Receipt #${ord.orderNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; font-size: 13px; color: #111827; background: #FFF; }
            .center { text-align: center; }
            .header { border-bottom: 1px dashed #D1D5DB; padding-bottom: 12px; margin-bottom: 12px; }
            .title { font-size: 20px; font-weight: 900; }
            .brand { color: #D96528; }
            .divider { border-top: 1px dashed #D1D5DB; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 12px; }
            .item-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 13px; }
            .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 850; margin-top: 6px; }
            .print-time { background: #F3F4F6; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #374151; margin-top: 6px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="header center">
            <div class="title">Foodies<span class="brand">Cafe</span></div>
            <div style="font-size: 11px; color: #6B7280; margin-top: 2px;">Official 80mm POS Thermal Receipt</div>
            <div style="font-size: 11px; color: #6B7280;">GST Registered · NTN: 8492019-3</div>
            <div style="font-size: 15px; font-weight: 850; margin-top: 6px;">Order #${ord.orderNumber}</div>
            <div style="font-size: 11px; color: #4B5563; margin-top: 2px;">${ord.type.toUpperCase().replace('_', ' ')} · ${orderBranch?.name || 'Main Branch'}</div>
            <div class="print-time">Printed Live: ${timestampStr}</div>
          </div>
          <div class="row"><span>Customer:</span><strong>${ord.customerName || 'Guest'}</strong></div>
          <div class="row"><span>Status:</span><strong>${ord.status.toUpperCase()}</strong></div>
          ${ord.tableNumber ? `<div class="row"><span>Table:</span><strong>${ord.tableNumber}</strong></div>` : ''}
          ${ord.deliveryAddress ? `<div class="row"><span>Delivery to:</span><strong>${ord.deliveryAddress}</strong></div>` : ''}
          <div class="divider"></div>
          <div>
            ${ord.items.map((it) => `
              <div class="item-row">
                <span>${it.quantity}x ${it.name}${it.size ? ` (${it.size})` : ''}</span>
                <strong>Rs. ${(Number(it.unitPrice) * Number(it.quantity)).toLocaleString()}</strong>
              </div>
            `).join('')}
          </div>
          <div class="divider"></div>
          <div class="row"><span>Subtotal:</span><span>Rs. ${Number(ord.originalSubtotal || ord.total).toLocaleString()}</span></div>
          <div class="row"><span>GST (16%):</span><span>Rs. ${Number(ord.tax || 0).toLocaleString()}</span></div>
          <div class="total-row"><span>GRAND TOTAL:</span><span style="color: #D96528;">Rs. ${Number(ord.total).toLocaleString()}</span></div>
          <div class="divider"></div>
          <div class="center" style="font-size: 11px; color: #6B7280; margin-top: 10px;">
            Thank you for dining with FoodiesCafe!<br>
            Exact time printed at that moment: ${liveTime}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);

    addToast({
      type: 'success',
      title: 'Receipt Printed ✓',
      message: `Bill for Order #${ord.orderNumber} printed live at ${liveTime}.`,
    });
  };

  // Calculate live total for edit items
  const currentSubtotal = currentDishes.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  const addMoreSubtotal = Object.entries(addedMoreCounts).reduce((acc, [dishId, qty]) => {
    const dish = menuItems.find((m) => m.id === dishId);
    return acc + (dish ? Number(dish.basePrice) * qty : 0);
  }, 0);
  const editSubtotal = currentSubtotal + addMoreSubtotal;
  const editTax = Math.round(editSubtotal * 0.16 * 10) / 10;
  const editGrandTotal = editSubtotal + editTax;

  const readyCount = activeOrders.filter(
    (o) => o.status === 'ready' || o.status === 'out_for_delivery'
  ).length;

  return (
    <div
      className="foodies-tracking-wrapper"
      style={{
        maxWidth: '860px',
        margin: '18px auto 40px',
        padding: '0 16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 850,
              color: 'var(--text-main)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Live Order Tracking
          </h1>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-muted)',
              margin: '3px 0 0',
            }}
          >
            {activeOrders.length} active {activeOrders.length === 1 ? 'order' : 'orders'} in progress
          </p>
        </div>

        {readyCount > 0 && (
          <div
            style={{
              backgroundColor: '#DCFCE7',
              border: '1px solid #86EFAC',
              borderRadius: '20px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.15)',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A', animation: 'pulse 1.5s infinite' }} />
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 850,
                color: '#15803D',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {readyCount} {readyCount === 1 ? 'ORDER READY' : 'ORDERS READY'}
            </span>
          </div>
        )}
      </div>

      {/* Orders List Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeOrders.map((ord) => {
          const isOutForDelivery = ord.type === 'delivery' && ord.status === 'out_for_delivery';
          const isReady = ord.status === 'ready';
          const isPreparing = ord.status === 'preparing';
          const displayStatus = isOutForDelivery
            ? 'ON THE WAY'
            : isReady
            ? 'READY'
            : isPreparing
            ? 'PREPARING'
            : 'PLACED';

          const canCancel =
            ord.status === 'placed' &&
            !ord.sentToKitchen &&
            !(ord.type === 'delivery' && Boolean(ord.assignedRiderId));
          const canAddItems =
            ['placed', 'accepted', 'preparing'].includes(ord.status) &&
            !isOutForDelivery &&
            !isReady;

          const placedTime = formatPlacedTime(ord.createdAt);
          const orderTypeDisplay = ord.type.toUpperCase().replace('_', ' ');
          const tableNumberText = ord.tableNumber
            ? ord.tableNumber.toLowerCase().startsWith('table')
              ? ord.tableNumber
              : `Table ${ord.tableNumber}`
            : 'Table T-01';

          const orderBranch = branches.find((b) => b.id === ord.branchId) || currentBranch;
          const locationDisplay =
            ord.type === 'delivery'
              ? ord.deliveryAddress || 'Doorstep Delivery Address'
              : getBranchTwoWords(orderBranch?.name || '');

          const finalStageLabel =
            ord.type === 'dine_in'
              ? 'Served'
              : ord.type === 'takeaway'
              ? 'Taken'
              : 'Delivered';

          return (
            <div
              key={ord.id}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: isReady ? '1.5px solid #86EFAC' : isOutForDelivery ? '1.5px solid #93C5FD' : '1px solid var(--border-color)',
                borderRadius: '20px',
                padding: '20px',
                boxShadow: isReady ? '0 6px 24px rgba(22, 163, 74, 0.12)' : '0 4px 18px var(--shadow-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Card Header: Order #FC-XXXX and Status Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 850, color: 'var(--text-main)' }}>
                  Order #{ord.orderNumber}
                </span>

                <div
                  style={{
                    backgroundColor: isOutForDelivery ? '#EFF6FF' : isReady ? '#DCFCE7' : isPreparing ? '#FFEDD5' : '#FEF3C7',
                    border: `1px solid ${isOutForDelivery ? '#BFDBFE' : isReady ? '#86EFAC' : isPreparing ? '#FDBA74' : '#FDE68A'}`,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {isOutForDelivery && <span style={{ fontSize: '13px' }}>🛵</span>}
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 850,
                      color: isOutForDelivery ? '#1D4ED8' : isReady ? '#15803D' : isPreparing ? '#C2410C' : '#B45309',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isOutForDelivery ? 'ON THE WAY' : displayStatus}
                  </span>
                </div>
              </div>

              {/* Line 2: Placed at time • Order Type • Table */}
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={13} />
                <span>
                  {ord.type === 'dine_in'
                    ? `Placed at ${placedTime} • DINE IN • ${tableNumberText}`
                    : `Placed at ${placedTime} • ${orderTypeDisplay}`}
                </span>
              </div>



              {/* Ready Process Callout Banner */}
              {isReady && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: '12px',
                    padding: '12px 14px',
                  }}
                >
                  <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#065F46', lineHeight: 1.4 }}>
                    {ord.type === 'dine_in'
                      ? `Dishes are READY! Floor waiter is serving to ${tableNumberText}.`
                      : ord.type === 'takeaway'
                      ? `Order is READY! Please show Order #${ord.orderNumber} to counter cashier to collect.`
                      : `Order is READY! Assigned rider will hand over at your doorstep.`}
                  </span>
                </div>
              )}

              {/* Items Box */}
              <div
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                {ord.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 650 }}>
                      • {it.quantity}x {it.name} {it.size ? `(${it.size})` : ''}
                    </span>
                    <span style={{ color: 'var(--primary)', fontWeight: 750 }}>
                      Rs. {(Number(it.unitPrice) * Number(it.quantity)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Card Footer: Location on left, action buttons on right */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '6px',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={locationDisplay}
                >
                  <span style={{ flexShrink: 0 }}>📍</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {locationDisplay}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Bill Button */}
                  <button
                    onClick={() => setSelectedReceipt(ord)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 750,
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Receipt size={13} color="var(--primary)" />
                    Bill
                  </button>

                  {/* + Add Item Button */}
                  {canAddItems && (
                    <button
                      onClick={() => handleOpenEditItems(ord)}
                      style={{
                        backgroundColor: 'var(--primary-light)',
                        border: '1px solid var(--primary-border)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 800,
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      + Add Item
                    </button>
                  )}

                  {/* On The Way Pill */}
                  {isOutForDelivery && (
                    <span
                      style={{
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        color: '#1D4ED8',
                      }}
                    >
                      Rider on route 🛵
                    </span>
                  )}

                  {/* Cancel Button: Allowed only before Cashier accepts */}
                  {canCancel && (
                    <button
                      onClick={() => setCancellingOrder(ord)}
                      style={{
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 750,
                        color: '#DC2626',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Cancel
                    </button>
                  )}

                  {/* Toggle Embedded Map View + External Directions Link */}
                  <button
                    onClick={() =>
                      setExpandedMapOrderId((prev) => (prev === ord.id ? null : ord.id))
                    }
                    title={ord.type === 'delivery' ? 'View Delivery Route on OpenStreetMap' : 'View Branch Location on Google Maps'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: expandedMapOrderId === ord.id ? '#FFF7ED' : '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 750,
                      color: '#EA580C',
                      cursor: 'pointer',
                    }}
                  >
                    <MapIcon size={13} />
                    <span>{expandedMapOrderId === ord.id ? 'Hide Map' : ord.type === 'delivery' ? 'OpenStreetMap' : 'Google Maps'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenDirections(ord)}
                    title={ord.type === 'delivery' ? 'Open Directions in OpenStreetMap' : 'Open Branch Location in Google Maps'}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-light)',
                      border: '1px solid var(--primary-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--primary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Navigation size={14} color="var(--primary)" />
                  </button>
                </div>
              </div>

              {expandedMapOrderId === ord.id && (
                <div style={{ marginTop: '8px' }}>
                  {ord.type !== 'delivery' ? (
                    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                      <div
                        style={{
                          backgroundColor: '#EFF6FF',
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid #BFDBFE',
                          fontSize: '11.5px',
                          fontWeight: 750,
                          color: '#1E40AF',
                        }}
                      >
                        <span>Google Maps • {orderBranch?.name || 'Branch'} Location</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${Number(orderBranch?.latitude) || 31.5126},${Number(orderBranch?.longitude) || 74.3436}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#2563EB', textDecoration: 'underline', fontSize: '11px', fontWeight: 800 }}
                        >
                          Open in Google Maps ↗
                        </a>
                      </div>
                      <iframe
                        width="100%"
                        height="220"
                        style={{ border: 0, display: 'block' }}
                        loading="lazy"
                        src={`https://maps.google.com/maps?q=${Number(orderBranch?.latitude) || 31.5126},${Number(orderBranch?.longitude) || 74.3436}&z=16&output=embed`}
                        title="Google Maps Branch Location"
                      />
                    </div>
                  ) : (
                    <OpenStreetMapView
                      center={
                        ord.customerCoordinates || customerCoordinates || {
                          lat: Number(orderBranch?.latitude) || 31.5126,
                          lng: Number(orderBranch?.longitude) || 74.3436,
                        }
                      }
                      zoom={13}
                      height={220}
                      markers={[
                        {
                          id: `track-branch-${ord.id}`,
                          lat: Number(orderBranch?.latitude) || 31.5126,
                          lng: Number(orderBranch?.longitude) || 74.3436,
                          title: orderBranch?.name || 'Branch',
                          kind: 'selected_branch',
                        },
                        ...(ord.customerCoordinates || customerCoordinates
                          ? [
                              {
                                id: `track-cust-${ord.id}`,
                                lat: (ord.customerCoordinates || customerCoordinates)!.lat,
                                lng: (ord.customerCoordinates || customerCoordinates)!.lng,
                                title: 'Delivery Pin',
                                kind: 'customer' as const,
                              },
                            ]
                          : []),
                      ]}
                      routeLine={
                        ord.customerCoordinates || customerCoordinates
                          ? {
                              from: {
                                lat: Number(orderBranch?.latitude) || 31.5126,
                                lng: Number(orderBranch?.longitude) || 74.3436,
                              },
                              to: (ord.customerCoordinates || customerCoordinates)!,
                              label: `${calculateHaversineKm(
                                Number(orderBranch?.latitude) || 31.5126,
                                Number(orderBranch?.longitude) || 74.3436,
                                (ord.customerCoordinates || customerCoordinates)!.lat,
                                (ord.customerCoordinates || customerCoordinates)!.lng
                              )} km`,
                            }
                          : null
                      }
                      showSearch={false}
                      showGpsButton={false}
                      modeLabel="OpenStreetMap • Delivery Route"
                      externalDirectionsOrigin={{
                        lat: Number(orderBranch?.latitude) || 31.5126,
                        lng: Number(orderBranch?.longitude) || 74.3436,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ================= EDIT / ADD ITEMS MODAL ================= */}
      {editingOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            backdropFilter: 'blur(3px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingOrder(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 30px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              animation: 'slideUp 0.25s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--text-main)', margin: 0 }}>
                  Add Items to Order #{editingOrder.orderNumber}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Adjust quantities or add signature dishes before kitchen cooking
                </p>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scroll Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* SECTION 1: Current Dishes */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                    Current Dishes ({currentDishes.filter((i) => i.quantity > 0).length})
                  </span>
                  {(editingOrder.status === 'preparing' || editingOrder.status === 'ready') && (
                    <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 700, backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '6px' }}>
                      🔒 Cooking in kitchen (Cannot reduce)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentDishes.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'var(--bg-main)',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {it.name} {it.size ? `(${it.size})` : ''}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 750 }}>
                          Rs. {it.unitPrice} each • Total: Rs. {(it.unitPrice * it.quantity).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleEditCurrentQty(it.id, -1)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          {it.quantity === 1 ? <Trash2 size={13} color="#DC2626" /> : <Minus size={13} />}
                        </button>
                        <span style={{ fontSize: '14px', fontWeight: 850, minWidth: '20px', textAlign: 'center' }}>
                          {it.quantity}
                        </span>
                        <button
                          onClick={() => handleEditCurrentQty(it.id, 1)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 2: + Add More Dishes */}
              <div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '10px' }}>
                  + Add More Signature Dishes ({addMoreDishes.length})
                </span>

                {/* Search Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '10px',
                  }}
                >
                  <Search size={15} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Search signature dishes to add..."
                    value={searchDishQuery}
                    onChange={(e) => setSearchDishQuery(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '13px',
                      flex: 1,
                      color: 'var(--text-main)',
                    }}
                  />
                  {searchDishQuery && (
                    <button
                      onClick={() => setSearchDishQuery('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} color="var(--text-muted)" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    paddingBottom: '8px',
                    marginBottom: '10px',
                  }}
                >
                  {availableCategories.map((cat) => {
                    const isActive = selectedAddCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedAddCategory(cat)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '16px',
                          border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'}`,
                          backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-main)',
                          color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                          fontSize: '11.5px',
                          fontWeight: 750,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Dishes List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                  {addMoreDishes.map((dish) => {
                    const count = addedMoreCounts[dish.id] || 0;
                    return (
                      <div
                        key={dish.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'var(--bg-main)',
                          borderRadius: '12px',
                          padding: '8px 12px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, marginRight: '10px' }}>
                          <img
                            src={dish.image || '/food-biryani.jpg'}
                            alt={dish.name}
                            style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/food-biryani.jpg';
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {dish.name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 750 }}>
                              Rs. {dish.basePrice}
                            </div>
                          </div>
                        </div>

                        {count === 0 ? (
                          <button
                            onClick={() => handleStepAddMore(dish.id, 1)}
                            style={{
                              backgroundColor: 'var(--primary)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            + Add
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => handleStepAddMore(dish.id, -1)}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Minus size={12} />
                            </button>
                            <span style={{ fontSize: '13.5px', fontWeight: 850, minWidth: '18px', textAlign: 'center' }}>
                              {count}
                            </span>
                            <button
                              onClick={() => handleStepAddMore(dish.id, 1)}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--primary)',
                                color: '#FFFFFF',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <span>Subtotal: Rs. {editSubtotal.toLocaleString()}</span>
                <span>GST (16%): Rs. {editTax.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Updated Grand Total:</span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary)' }}>Rs. {editGrandTotal.toLocaleString()}</span>
              </div>

              {editGrandTotal > 0 ? (
                <button
                  onClick={handleSaveEditItems}
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px var(--primary-glow)',
                  }}
                >
                  Update Order & Send to Kitchen (Rs. {editGrandTotal.toLocaleString()}) ➔
                </button>
              ) : (
                <button
                  onClick={handleSaveEditItems}
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  All Items Deselected — Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= CANCEL CONFIRMATION MODAL ================= */}
      {cancellingOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(3px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancellingOrder(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: 'var(--shadow-xl)',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#FEE2E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={30} color="#DC2626" />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--text-main)', margin: 0 }}>
              Cancel Order #{cancellingOrder.orderNumber}?
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to cancel this order? Once confirmed, this order will be cancelled and moved to Order History.
            </p>

            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '10px' }}>
              <button
                onClick={() => setCancellingOrder(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: 750,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                }}
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancelOrder}
                style={{
                  flex: 1,
                  padding: '11px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 80MM THERMAL RECEIPT / BILL MODAL ================= */}
      {selectedReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(3px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedReceipt(null);
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              color: '#111827',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '380px',
              padding: '22px',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #D1D5DB', paddingBottom: '12px' }}>
              <button
                onClick={() => setSelectedReceipt(null)}
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#9CA3AF',
                }}
              >
                <X size={18} />
              </button>
              <div style={{ fontSize: '20px', fontWeight: 900 }}>Foodies<span style={{ color: '#D96528' }}>Cafe</span></div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>Official 80mm POS Thermal Receipt</div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>GST Registered • NTN: 8492019-3</div>
            </div>

            {/* Meta */}
            <div style={{ padding: '10px 0', borderBottom: '1px dashed #D1D5DB', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Order:</span>
                <strong>#{selectedReceipt.orderNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Date:</span>
                <span>{parseDateSafe(selectedReceipt.createdAt)?.toLocaleDateString() || new Date().toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Placed At:</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{formatPlacedTime(selectedReceipt.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Type:</span>
                <span style={{ fontWeight: 700 }}>{selectedReceipt.type.toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Status:</span>
                <span style={{ fontWeight: 800, color: '#059669' }}>{selectedReceipt.status.toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Printed At:</span>
                <span style={{ fontWeight: 800, color: '#D96528' }}>
                  {formatPlacedTime(new Date().toISOString())}
                </span>
              </div>
            </div>

            {/* Items List */}
            <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '8px 0', borderBottom: '1px dashed #D1D5DB', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedReceipt.items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span>{it.quantity}x {it.name}</span>
                  <strong>Rs. {(Number(it.unitPrice) * Number(it.quantity)).toLocaleString()}</strong>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ padding: '10px 0', borderBottom: '1px dashed #D1D5DB', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Subtotal</span>
                <span>Rs. {(selectedReceipt.originalSubtotal || selectedReceipt.total).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>GST (16%)</span>
                <span>Rs. {(selectedReceipt.tax || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 900, marginTop: '4px' }}>
                <span>GRAND TOTAL</span>
                <span style={{ color: '#D96528' }}>Rs. {selectedReceipt.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '12px 0 10px', fontSize: '11px', color: '#6B7280' }}>
              Thank you for dining with FoodiesCafe!<br />
              Printed live at that exact moment
            </div>

            {/* Print Button */}
            <button
              onClick={() => handlePrintSlip(selectedReceipt)}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                padding: '11px',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px var(--primary-glow)',
              }}
            >
              <Printer size={16} />
              Print Thermal Slip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export { OrderTrackingScreen as CustomerTracking };
