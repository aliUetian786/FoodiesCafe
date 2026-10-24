'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, OrderStatus } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  ChefHat,
  Clock,
  Printer,
  CheckCircle,
  AlertOctagon,
  Flame,
  ArrowRight,
  ShieldCheck,
  UtensilsCrossed,
  X,
  Search,
  Check,
} from 'lucide-react';

export const KitchenQueueScreen: React.FC = () => {
  const { orders, updateOrderStatus, currentBranch, toggleMenuItemBranchAvailability, menuItems, addToast, currentRole, footerSettings } = useApp();

  const isManager = currentRole === 'branch_manager';

  const [confirmReadyOrderId, setConfirmReadyOrderId] = useState<string | null>(null);
  const [unavailableModalOpen, setUnavailableModalOpen] = useState(false);
  const [dishSearch, setDishSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'unavailable' | 'available'>('all');

  const branchOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'completed' && (!o.branchId || o.branchId === currentBranch.id));

  // Determine if order is authorized for kitchen queue (or currently held at Customer Services)
  const isOrderDispatchedToKitchen = (o: Order) => {
    if (footerSettings?.orderRoutingSupportFirst === false) return true;
    if (o.sentToKitchen) return true;
    if (o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready' || o.status === 'served') return true;
    if (o.forwardToKitchenAt && Date.now() >= new Date(o.forwardToKitchenAt).getTime()) return true;
    return false;
  };

  const incomingOrders = branchOrders.filter((o) => (o.status === 'placed' || o.status === 'accepted') && isOrderDispatchedToKitchen(o));
  const heldAtSupportOrders = branchOrders.filter((o) => o.status === 'placed' && !isOrderDispatchedToKitchen(o));
  const preparingOrders = branchOrders.filter((o) => o.status === 'preparing');
  const readyOrders = branchOrders.filter((o) => o.status === 'ready');
  const servedOrders = branchOrders.filter((o) => o.status === 'served');

  const unavailableItems = menuItems.filter((m) => m.branchAvailability[currentBranch.id] === false);

  // Manager Kitchen Status Metrics (Came Today, Accepted Today, Prepared Today)
  const allBranchOrdersToday = orders.filter((o) => !o.branchId || o.branchId === currentBranch.id);
  const cameTodayCount = allBranchOrdersToday.length;
  const acceptedTodayCount = allBranchOrdersToday.filter(
    (o) => o.status !== 'placed' && o.status !== 'cancelled'
  ).length;
  const preparedTodayCount = allBranchOrdersToday.filter(
    (o) => o.status === 'ready' || o.status === 'served' || o.status === 'completed'
  ).length;

  const handleStartPreparing = (orderId: string) => {
    updateOrderStatus(orderId, 'preparing');
  };

  const handleMarkReadyConfirm = () => {
    if (!confirmReadyOrderId) return;
    updateOrderStatus(confirmReadyOrderId, 'ready');
    setConfirmReadyOrderId(null);
  };

  const handleMarkToServe = (orderId: string) => {
    updateOrderStatus(orderId, 'served');
    const ord = orders.find((o) => o.id === orderId);
    addToast({
      type: 'info',
      title: 'Dispatched to Floor Staff / Waiter 🍽️',
      message: `Order #${ord?.orderNumber || ''} sent to server for Table ${ord?.tableNumber || 'Counter'}.`,
    });
  };

  const handleToggleItemAvailability = (itemId: string) => {
    if (isManager) {
      addToast({
        type: 'warning',
        title: 'Kitchen Chef Authority Required',
        message: 'Ingredient out-of-stock toggles are operated directly by Kitchen Chefs.',
      });
      return;
    }
    toggleMenuItemBranchAvailability(itemId, currentBranch.id);
    const item = menuItems.find((m) => m.id === itemId);
    const isCurrentlyUnavailable = item?.branchAvailability[currentBranch.id] === false;

    if (isCurrentlyUnavailable) {
      addToast({
        type: 'success',
        title: 'Item Available Again ✓',
        message: `${item?.name} is now back in stock for ${currentBranch.name}.`,
      });
    } else {
      addToast({
        type: 'warning',
        title: 'Item Marked Unavailable',
        message: `${item?.name} flagged out of stock for ${currentBranch.name}.`,
      });
    }
  };

  // Thermal 80mm Print Ticket with 135-degree rotated Logo Watermark
  const handlePrintKOT = (ord: Order) => {
    const existingIframe = document.getElementById('foodies-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'foodies-print-iframe';
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

    const itemsHtml = ord.items
      .map(
        (item) => `
        <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 700; margin-bottom: 6px; border-bottom: 1px dotted #CBD5E1; padding-bottom: 4px;">
          <span>${item.quantity} × ${item.name}</span>
          ${item.isAddOn ? '<span style="color: #EA580C; font-size: 11px;">[NEW ADD-ON]</span>' : ''}
        </div>
        ${item.size ? `<div style="font-size: 11px; color: #64748B; margin-top: -3px; margin-bottom: 3px;">Portion: ${item.size}</div>` : ''}
        ${item.instructions ? `<div style="font-size: 11.5px; color: #EA580C; font-style: italic; margin-bottom: 4px;">Note: "${item.instructions}"</div>` : ''}
      `
      )
      .join('');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kitchen Ticket #${ord.orderNumber}</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 80mm;
              margin: 0 auto;
              padding: 4mm 2mm;
              background: #FFFFFF !important;
              color: #1A1A1A !important;
            }
            .kot-container {
              width: 100% !important;
              max-width: 80mm !important;
              border: 1px dashed #CBD5E1 !important;
              border-radius: 6px !important;
              padding: 16px 12px !important;
              background: #FFFFFF !important;
              position: relative !important;
              overflow: hidden !important;
              box-shadow: none !important;
            }
          </style>
        </head>
        <body>
          <div class="kot-container">
            <!-- 135-degree rotated Cafe Logo Watermark -->
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none; z-index: 0;">
              <img src="/logo.png" alt="Logo Watermark" style="width: 85%; height: 85%; object-fit: contain; transform: rotate(135deg); opacity: 0.16; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact;" />
            </div>
            
            <div style="position: relative; z-index: 1;">
              <div style="text-align: center; border-bottom: 1px dashed #000000; padding-bottom: 8px; margin-bottom: 10px;">
                <h3 style="font-size: 18px; font-weight: 900; margin: 0; font-family: 'Outfit', sans-serif;">FOODIES CAFE · KITCHEN KOT</h3>
                <div style="font-size: 11px; color: #475569; margin-top: 2px;">${currentBranch.name}</div>
                <div style="font-size: 14px; font-weight: 850; color: #EA580C; margin-top: 4px;">
                  ${ord.type === 'dine_in' ? `DINE-IN · TABLE ${ord.tableNumber || '?'}` : ord.type === 'takeaway' ? 'TAKEAWAY COUNTER' : 'DELIVERY DISPATCH'}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px; color: #64748B;">
                <span>Ticket: <strong>#${ord.orderNumber}</strong></span>
                <span>Time: ${ord.createdAt}</span>
              </div>

              <div style="border-top: 1px solid #E2E8F0; padding-top: 8px; margin-bottom: 12px;">
                ${itemsHtml}
              </div>

              <div style="text-align: center; font-size: 10px; color: #64748B; border-top: 1px dashed #CBD5E1; padding-top: 6px;">
                Printed for Kitchen Preparation · FoodiesCafe
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
      }, 2000);
    }, 300);
  };

  const renderTicket = (ord: Order) => (
    <div
      key={ord.id}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.04em' }}>
              {ord.type === 'dine_in' ? `DINE-IN · TABLE ${ord.tableNumber || '?'}` : ord.type === 'takeaway' ? 'TAKEAWAY COUNTER' : 'DELIVERY'}
            </span>
            {ord.sentToKitchen && (
              <span style={{ fontSize: '9.5px', fontWeight: 800, backgroundColor: '#DCFCE7', color: '#166534', padding: '1px 6px', borderRadius: '4px' }}>
                ✓ Customer Services
              </span>
            )}
          </div>
          <h4 style={{ fontSize: '18px', fontWeight: 850, margin: '2px 0 0', color: 'var(--text-main)' }}>
            Ticket #{ord.orderNumber}
          </h4>
        </div>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
          {ord.createdAt}
        </span>
      </div>

      {/* Items list with NEW ADD-ON highlighted */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
        {ord.items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: item.isAddOn ? '8px 10px' : '4px 0',
              borderRadius: item.isAddOn ? '6px' : '0',
              backgroundColor: item.isAddOn ? 'var(--primary-light)' : 'transparent',
              border: item.isAddOn ? '1px solid var(--primary)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: item.isAddOn ? 'var(--primary)' : 'var(--text-main)' }}>
                {item.quantity} × {item.name}
              </div>
              {item.isAddOn && (
                <span style={{ fontSize: '10px', fontWeight: 800, backgroundColor: 'var(--primary)', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px' }}>
                  NEW ADD-ON
                </span>
              )}
            </div>

            {item.size && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Portion: {item.size}
              </div>
            )}
            {item.extras && item.extras.length > 0 && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                + {item.extras.join(', ')}
              </div>
            )}
            {item.instructions && (
              <div style={{ fontSize: '12px', color: '#EA580C', fontWeight: 600, fontStyle: 'italic', marginTop: '2px' }}>
                Note: &ldquo;{item.instructions}&rdquo;
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons for Kitchen */}
      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', alignItems: 'center' }}>
        {isManager ? (
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              fontSize: '11.5px',
              fontWeight: 800,
              backgroundColor:
                ord.status === 'preparing'
                  ? 'var(--status-preparing-bg)'
                  : ord.status === 'ready'
                  ? 'rgba(22, 163, 74, 0.1)'
                  : ord.status === 'served'
                  ? 'rgba(139, 92, 246, 0.1)'
                  : 'var(--bg-card-subtle)',
              color:
                ord.status === 'preparing'
                  ? 'var(--status-preparing-text)'
                  : ord.status === 'ready'
                  ? '#16A34A'
                  : ord.status === 'served'
                  ? '#8B5CF6'
                  : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            {ord.status === 'placed' || ord.status === 'accepted'
              ? '⏳ Arrived (Chef Acknowledging)'
              : ord.status === 'preparing'
              ? '🔥 Cooking in Progress'
              : ord.status === 'ready'
              ? '✓ Prepared & Plated (Ready)'
              : '🍽️ Dispatched to Waiter / Floor'}
          </div>
        ) : ord.status === 'placed' || ord.status === 'accepted' ? (
          <button
            onClick={() => handleStartPreparing(ord.id)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
            }}
          >
            <Flame size={16} />
            <span>Start Preparing</span>
          </button>
        ) : ord.status === 'preparing' ? (
          <button
            onClick={() => setConfirmReadyOrderId(ord.id)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#16A34A',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
            }}
          >
            <CheckCircle size={16} />
            <span>Mark Ready</span>
          </button>
        ) : ord.status === 'ready' ? (
          <button
            onClick={() => handleMarkToServe(ord.id)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#8B5CF6',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
            }}
          >
            <UtensilsCrossed size={16} />
            <span>Mark to Serve (Send to Waiter)</span>
          </button>
        ) : (
          <div style={{ flex: 1, textAlign: 'center', color: '#8B5CF6', fontWeight: 800, fontSize: '12.5px' }}>
            ✓ Sent to Waiter / Floor
          </div>
        )}

        <button
          onClick={() => handlePrintKOT(ord)}
          title="Print Kitchen KOT Ticket (with 135° Watermark)"
          style={{
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Printer size={16} />
        </button>
      </div>
    </div>
  );

  const filteredMenuItems = menuItems.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(dishSearch.toLowerCase()) || m.category.toLowerCase().includes(dishSearch.toLowerCase());
    const isUnavailable = m.branchAvailability[currentBranch.id] === false;
    if (availabilityFilter === 'unavailable') return matchesSearch && isUnavailable;
    if (availabilityFilter === 'available') return matchesSearch && !isUnavailable;
    return matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Kitchen Top Bar & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 850, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {isManager ? 'Kitchen Operations Status Monitor' : 'Live Kitchen Queue Board'}
            </h1>
            {isManager && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(234, 88, 12, 0.12)',
                  color: '#EA580C',
                  border: '1px solid rgba(234, 88, 12, 0.3)',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}
              >
                👀 Read-Only Status Monitor
              </span>
            )}
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Branch: <strong>{currentBranch.name}</strong> ·{' '}
            {isManager
              ? 'Real-time kitchen status: Orders arrived today, accepted & prepared pipeline'
              : 'Real-time order progress & dish availability controls'}
          </p>
        </div>

        {/* Stock / Dish Availability Button */}
        <button
          onClick={() => setUnavailableModalOpen(true)}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: unavailableItems.length > 0 ? '#FEF2F2' : 'var(--bg-card)',
            color: unavailableItems.length > 0 ? '#DC2626' : 'var(--text-main)',
            border: unavailableItems.length > 0 ? '1.5px solid #F87171' : '1px solid var(--border-color)',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <AlertOctagon size={16} color={unavailableItems.length > 0 ? '#DC2626' : 'var(--primary)'} />
          <span>
            {unavailableItems.length > 0
              ? `${unavailableItems.length} Dishes Unavailable ${isManager ? '(View Stock)' : '(Manage Stock)'}`
              : isManager
              ? 'View Kitchen Stock Status'
              : 'Dish Availability & Stock'}
          </span>
        </button>
      </div>

      {/* MANAGER KITCHEN STATUS OVERVIEW CARDS: Came Today, Accepted Today, Prepared Today */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '18px 20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 750, textTransform: 'uppercase' }}>
            Orders Came Today
          </span>
          <div style={{ fontSize: '30px', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
            {cameTodayCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>Total branch orders arrived</span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '18px 20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 750, textTransform: 'uppercase' }}>
            Orders Accepted
          </span>
          <div style={{ fontSize: '30px', fontWeight: 900, color: '#2563EB', marginTop: '4px' }}>
            {acceptedTodayCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Acknowledged by kitchen</span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '18px 20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 750, textTransform: 'uppercase' }}>
            Orders Prepared
          </span>
          <div style={{ fontSize: '30px', fontWeight: 900, color: '#16A34A', marginTop: '4px' }}>
            {preparedTodayCount}
          </div>
          <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>Cooked & ready for service</span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '18px 20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 750, textTransform: 'uppercase' }}>
            Currently Cooking
          </span>
          <div style={{ fontSize: '30px', fontWeight: 900, color: '#EA580C', marginTop: '4px' }}>
            {preparingOrders.length}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active in kitchen right now</span>
        </div>
      </div>

      {/* 4-COLUMN KANBAN QUEUE: Incoming -> Preparing -> Ready -> Sent to Waiter */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '18px',
        }}
      >
        {/* 1. Incoming Column */}
        <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 850, textTransform: 'uppercase', color: 'var(--text-main)' }}>
              1. Incoming Orders
            </span>
            <span style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>
              {incomingOrders.length}
            </span>
          </div>

          {heldAtSupportOrders.length > 0 && (
            <div
              style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #FCD34D',
                borderRadius: 'var(--radius-md)',
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                color: '#92400E',
                fontWeight: 700,
              }}
            >
              <Clock size={13} style={{ flexShrink: 0 }} />
              <span>{heldAtSupportOrders.length} order(s) under review at Customer Services Desk</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {incomingOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No incoming tickets
              </div>
            ) : (
              incomingOrders.map(renderTicket)
            )}
          </div>
        </div>

        {/* 2. Preparing Column */}
        <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 850, textTransform: 'uppercase', color: '#C2410C' }}>
              2. Now Preparing
            </span>
            <span style={{ backgroundColor: '#EA580C', color: '#FFFFFF', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>
              {preparingOrders.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {preparingOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Kitchen clear
              </div>
            ) : (
              preparingOrders.map(renderTicket)
            )}
          </div>
        </div>

        {/* 3. Ready Column */}
        <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 850, textTransform: 'uppercase', color: '#15803D' }}>
              3. Ready for Service
            </span>
            <span style={{ backgroundColor: '#16A34A', color: '#FFFFFF', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>
              {readyOrders.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {readyOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No tickets waiting
              </div>
            ) : (
              readyOrders.map(renderTicket)
            )}
          </div>
        </div>

        {/* 4. Sent to Waiter / Out for Service Column */}
        <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 850, textTransform: 'uppercase', color: '#7C3AED' }}>
              4. Sent to Waiter
            </span>
            <span style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>
              {servedOrders.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {servedOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No active orders with server
              </div>
            ) : (
              servedOrders.map(renderTicket)
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Popup before Marking Ready */}
      <ModalConfirmation
        isOpen={!!confirmReadyOrderId}
        onClose={() => setConfirmReadyOrderId(null)}
        onConfirm={handleMarkReadyConfirm}
        title="Mark Order Ready for Service?"
        message="This will notify the floor staff / counter cashier and trigger the customer 'Ready' notification."
        confirmText="Yes, food is ready"
        cancelText="No, go back"
      />

      {/* DISH AVAILABILITY & STOCK MANAGER MODAL */}
      {unavailableModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: '24px',
              borderRadius: '20px',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 850, margin: 0, color: 'var(--text-main)' }}>
                  Manage Dish Availability & Stock
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Branch: <strong>{currentBranch.name}</strong> · Mark dishes unavailable when ingredients run out, and restore availability when restocked.
                </p>
              </div>
              <button
                onClick={() => setUnavailableModalOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  placeholder="Search dishes or categories..."
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card-subtle)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {(['all', 'unavailable', 'available'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAvailabilityFilter(filter)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: availabilityFilter === filter ? 'var(--primary)' : 'transparent',
                      color: availabilityFilter === filter ? '#FFFFFF' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Dishes List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', maxHeight: '420px' }}>
              {filteredMenuItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No dishes found matching filters.
                </div>
              ) : (
                filteredMenuItems.map((dish) => {
                  const isUnavailable = dish.branchAvailability[currentBranch.id] === false;

                  return (
                    <div
                      key={dish.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: isUnavailable ? '1px solid #FCA5A5' : '1px solid var(--border-color)',
                        backgroundColor: isUnavailable ? '#FEF2F2' : 'var(--bg-card-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                            {dish.name}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isUnavailable ? '#EF4444' : '#10B981',
                              color: '#FFFFFF',
                            }}
                          >
                            {isUnavailable ? 'UNAVAILABLE' : 'IN STOCK'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Category: {dish.category} · Rs. {dish.basePrice.toLocaleString()}
                        </div>
                      </div>

                      {/* Action Button: Toggle Availability */}
                      <button
                        onClick={() => handleToggleItemAvailability(dish.id)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          border: isUnavailable ? '1px solid #10B981' : '1px solid #EF4444',
                          backgroundColor: isUnavailable ? '#10B981' : '#FFFFFF',
                          color: isUnavailable ? '#FFFFFF' : '#EF4444',
                          fontWeight: 750,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        {isUnavailable ? (
                          <>
                            <Check size={14} />
                            <span>Remove Unavailable Status (Make Available)</span>
                          </>
                        ) : (
                          <>
                            <X size={14} />
                            <span>Mark Unavailable</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button
                onClick={() => setUnavailableModalOpen(false)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 750,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
