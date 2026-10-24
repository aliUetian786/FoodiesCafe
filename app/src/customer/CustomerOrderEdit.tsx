'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { OrderItem } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react';

interface EditOrderScreenProps {
  onNavigate: (view: string) => void;
}

export const EditOrderScreen: React.FC<EditOrderScreenProps> = ({ onNavigate }) => {
  const { orders, currentUser, editOrderStage1, menuItems, cancelOrder, addToast } = useApp();

  // Find customer's active order by phone/id, or fallback to most recent active order
  const activeOrder =
    (currentUser?.phone
      ? orders.find((o) => o.customerPhone === currentUser.phone && o.status !== 'completed' && o.status !== 'cancelled') ||
        orders.find((o) => o.customerPhone === currentUser.phone)
      : null) ||
    orders.find((o) => o.status !== 'completed' && o.status !== 'cancelled') ||
    orders[0];

  // Initialize and synchronize items from activeOrder
  const [items, setItems] = useState<OrderItem[]>(() => {
    if (activeOrder && Array.isArray(activeOrder.items) && activeOrder.items.length > 0) {
      return activeOrder.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice) || 0,
        quantity: Number(i.quantity) || 1,
      }));
    }
    return [];
  });

  const lastOrderIdRef = useRef<string | null>(activeOrder?.id || null);
  useEffect(() => {
    if (activeOrder && (lastOrderIdRef.current !== activeOrder.id || (items.length === 0 && activeOrder.items && activeOrder.items.length > 0))) {
      lastOrderIdRef.current = activeOrder.id;
      setItems(
        activeOrder.items.map((i) => ({
          ...i,
          unitPrice: Number(i.unitPrice) || 0,
          quantity: Number(i.quantity) || 1,
        }))
      );
    }
  }, [activeOrder]);

  const [newAddOnItemId, setNewAddOnItemId] = useState<string>(menuItems[0]?.id || 'm1');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!activeOrder) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 800 }}>No Order to Edit</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          You don't have an active order to edit right now.
        </p>
        <button
          onClick={() => onNavigate('menu')}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontWeight: 700,
          }}
        >
          Return to Menu
        </button>
      </div>
    );
  }

  // Calculate totals
  const currentTotal = items.reduce((acc, i) => acc + Number(i.unitPrice) * Number(i.quantity), 0);

  // Quantity control
  const handleQtyChange = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, Number(i.quantity) + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddNewItem = () => {
    const selected = menuItems.find((m) => m.id === newAddOnItemId) || menuItems[0];
    if (!selected) return;

    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.menuItemId === selected.id);
      if (existingIdx > -1) {
        return prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      const newItem: OrderItem = {
        id: `edit-add-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        menuItemId: selected.id,
        name: selected.name,
        unitPrice: Number(selected.basePrice),
        quantity: 1,
        isAddOn: false,
      };
      return [...prev, newItem];
    });
  };

  // Primary action: If items are deselected (items.length === 0), it cancels the order.
  // If items are present, it saves / updates the order.
  const handleActionClick = () => {
    if (items.length === 0) {
      cancelOrder(activeOrder.id, 'All items deselected from order by customer');
      addToast({
        type: 'warning',
        title: 'Order Cancelled',
        message: `Order #${activeOrder.orderNumber} has been cancelled because all items were deselected.`,
      });
      onNavigate('order-tracking');
    } else {
      setIsConfirmOpen(true);
    }
  };

  const handleConfirmedUpdate = () => {
    editOrderStage1(activeOrder.id, items);
    setIsConfirmOpen(false);
    onNavigate('order-tracking');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '24px auto 80px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Edit Order Card with Arrow at Top-Left Corner */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Top-Left Arrow and Order Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => onNavigate('order-tracking')}
            aria-label="Back to Tracking"
            title="Back to Tracking"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Edit Order #{activeOrder.orderNumber}
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Add or remove items, adjust quantities, or add new dishes to this order.
            </div>
          </div>
        </div>

        {/* ITEMS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Current Order Dishes ({items.length})
          </div>

          {items.length === 0 ? (
            <div
              style={{
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-cancelled-bg)',
                border: '1px dashed #EF4444',
                color: '#DC2626',
                textAlign: 'center',
                fontSize: '13.5px',
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              All items have been deselected. Click <strong>Cancel Order</strong> below to cancel this order, or select dishes below to add them back.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: 'var(--bg-card-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Rs. {Number(item.unitPrice).toLocaleString()} each
                    </div>
                  </div>

                  {/* Quantity Stepper & Remove */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-full)',
                        padding: '4px 8px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleQtyChange(item.id, -1)}
                        style={{
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-main)',
                        }}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: 800, minWidth: '20px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(item.id, 1)}
                        style={{
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-main)',
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      title="Remove item"
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>

                    <span style={{ fontWeight: 800, fontSize: '15px', minWidth: '85px', textAlign: 'right', color: 'var(--text-main)' }}>
                      Rs. {(Number(item.unitPrice) * Number(item.quantity)).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ADD NEW DISH FROM MENU */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={newAddOnItemId}
            onChange={(e) => setNewAddOnItemId(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '13.5px',
              fontWeight: 600,
              outline: 'none',
            }}
          >
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (+Rs. {Number(m.basePrice).toLocaleString()})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAddNewItem}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              fontWeight: 800,
              fontSize: '13.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: '1px solid var(--primary)',
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={16} />
            <span>Add Dish</span>
          </button>
        </div>

        {/* ORDER TOTAL SUMMARY */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Updated Order Amount</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: items.length === 0 ? '#DC2626' : 'var(--primary)' }}>
              Rs. {currentTotal.toLocaleString()}
            </div>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Cash payment at cafe
          </div>
        </div>

        {/* BOTTOM ACTION BUTTON: "Cancel Order" when items.length === 0, else "Update Order" */}
        <button
          type="button"
          onClick={handleActionClick}
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: items.length === 0 ? '#DC2626' : 'var(--primary)',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 800,
            border: 'none',
            boxShadow: items.length === 0 ? '0 4px 16px rgba(220, 38, 38, 0.35)' : '0 4px 16px var(--primary-glow)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {items.length === 0 ? 'Cancel Order' : 'Update Order'}
        </button>
      </div>

      {/* CONFIRMATION POPUP FOR UPDATING ORDER */}
      <ModalConfirmation
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmedUpdate}
        title="Update this order?"
        message="Are you sure you want to update your order items for kitchen preparation?"
        details={`Order #${activeOrder.orderNumber} · New total: Rs. ${currentTotal.toLocaleString()}`}
        confirmText="Yes, update order"
        cancelText="No, keep editing"
      />
    </div>
  );
};
