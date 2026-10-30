'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Order } from '@/types/cafe';
import {
  Receipt,
  FileText,
  Clock,
  MapPin,
  Banknote,
  Printer,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';

export const OrderHistoryScreen: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const { orders, currentUser, addToCart, addToast } = useApp();

  const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
  const userPhoneClean = normalizePhone(currentUser?.phone);

  // STRICT PHONE FILTER: Never show all orders, never match by name
  const customerOrders = React.useMemo(() => {
    if (!userPhoneClean && (!currentUser?.id || currentUser.id === 'user-guest')) {
      return [];
    }
    return orders.filter((o) => {
      if (userPhoneClean && normalizePhone(o.customerPhone) === userPhoneClean) return true;
      if (currentUser?.id && currentUser.id !== 'user-guest' && o.customerId === currentUser.id) return true;
      return false;
    });
  }, [orders, userPhoneClean, currentUser]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(customerOrders[0] || null);

  React.useEffect(() => {
    if (customerOrders.length > 0) {
      if (!selectedOrder || !customerOrders.some((o) => o.id === selectedOrder.id)) {
        setSelectedOrder(customerOrders[0]);
      }
    } else {
      setSelectedOrder(null);
    }
  }, [customerOrders, selectedOrder]);

  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      addToCart({
        id: `cart-reorder-${Date.now()}-${Math.random()}`,
        menuItemId: item.menuItemId,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        size: 'Standard',
      });
    });
    addToast({
      type: 'success',
      title: 'Order Reordered! 🛒',
      message: `${order.items.length} item(s) from Order #${order.orderNumber} added to your cart.`,
    });
    onNavigate('menu');
  };

  const formatOrderDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const lower = dateStr.toLowerCase();
    if (lower.includes('ago') || lower.includes('just now')) {
      const d = new Date();
      if (lower.includes('15 min')) d.setMinutes(d.getMinutes() - 15);
      else if (lower.includes('10 min')) d.setMinutes(d.getMinutes() - 10);
      else if (lower.includes('1 hour') || lower.includes('hr')) d.setHours(d.getHours() - 1);
      else if (lower.includes('2 hour') || lower.includes('hrs')) d.setHours(d.getHours() - 2);
      return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    }
    return dateStr;
  };

  const handlePrintReceipt = () => {
    const receiptEl = document.getElementById('printable-order-receipt');
    if (!receiptEl) {
      window.print();
      return;
    }

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

    const clone = receiptEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach((el) => el.remove());

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Paid Slip</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @page {
              size: 80mm auto;
              margin: 0 !important;
              padding: 0 !important;
            }
            * {
              box-sizing: border-box !important;
              margin: 0;
              padding: 0;
              font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #FFFFFF !important;
              color: #000000 !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
            }
            #printable-order-receipt {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 6px 8px 4px 8px !important;
              border: none !important;
              border-radius: 0 !important;
              background: #FFFFFF !important;
              position: relative !important;
              overflow: hidden !important;
              box-shadow: none !important;
              height: auto !important;
              min-height: 0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .no-print { display: none !important; }
            img {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          ${clone.outerHTML}
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

  return (
    <div
      className="foodies-order-history-view"
      style={{
        maxWidth: '1180px',
        margin: '16px auto',
        padding: '0 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        height: 'calc(100vh - 105px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Static Header without ' & Itemized Receipts' or snapshot text */}
      <div style={{ flexShrink: 0 }}>
        <h1 style={{ fontSize: '28px', fontWeight: 850, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
          Order History
        </h1>
      </div>

      {customerOrders.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '40px 20px',
            textAlign: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingBag size={30} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--text-main)', margin: 0 }}>
            No Orders Found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '380px' }}>
            No past orders linked to mobile number {currentUser?.phone || 'your account'} yet. Start ordering delicious meals from our kitchen!
          </p>
          <button
            onClick={() => onNavigate('menu')}
            style={{
              marginTop: '6px',
              padding: '10px 22px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              boxShadow: '0 4px 14px var(--primary-glow)',
            }}
          >
            Browse Foodies Menu 🍲
          </button>
        </div>
      ) : (
        /* Static Sub-Cards Grid: Only Left Orders List and Right Receipt Card Scroll */
        <div
          className="foodies-history-master-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: '370px 1fr',
            gap: '24px',
            alignItems: 'stretch',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Left Sub-Card: Scrollable Orders List */}
          <div
            className="foodies-history-left-subcard"
            style={{
              height: '100%',
              overflowY: 'auto',
              paddingRight: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {customerOrders.map((ord) => {
            const isSelected = selectedOrder?.id === ord.id;
            return (
              <div
                key={ord.id}
                onClick={() => setSelectedOrder(ord)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  padding: '18px',
                  boxShadow: isSelected ? '0 4px 16px var(--primary-glow)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {/* Cafe Logo Watermark at 135 Degrees */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                >
                  <img
                    src="/logo.png"
                    alt="Logo Watermark"
                    style={{
                      width: '75%',
                      height: '75%',
                      objectFit: 'contain',
                      transform: 'rotate(135deg)',
                      opacity: 0.12,
                      display: 'block',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>
                    Order #{ord.orderNumber}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--status-preparing-bg)',
                      color: 'var(--status-preparing-text)',
                    }}
                  >
                    {ord.status}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', position: 'relative', zIndex: 1 }}>
                  {formatOrderDateTime(ord.createdAt)} · {ord.type.toUpperCase()} {ord.tableNumber ? `(Table ${ord.tableNumber})` : ''}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>
                    Rs. {ord.total.toLocaleString()}
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <ChevronRight size={16} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Sub-Card: Scrollable Printable Receipt (Order Detail Card) */}
        {selectedOrder && (
          <div
            id="printable-order-receipt"
            className="foodies-history-right-subcard"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '1.5px solid var(--border-color)',
              padding: '28px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              height: '100%',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            {/* Cafe Logo at 135 Degrees adjusted to card size */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              <img
                src="/logo.png"
                alt="Cafe Logo Watermark"
                style={{
                  width: '85%',
                  height: '85%',
                  objectFit: 'contain',
                  transform: 'rotate(135deg)',
                  opacity: 0.16,
                  display: 'block',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                }}
              />
            </div>

            {/* Print Receipt Button placed at Top Right Corner (sticky) */}
            <button
              className="no-print"
              onClick={handlePrintReceipt}
              style={{
                position: 'sticky',
                top: 0,
                alignSelf: 'flex-end',
                marginTop: '-8px',
                marginBottom: '-28px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 13px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                zIndex: 10,
              }}
            >
              <Printer size={14} color="var(--primary)" />
              <span>Print Receipt</span>
            </button>

            {/* Receipt Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '16px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '20px', fontFamily: 'Outfit' }}>
                Foodies<span style={{ color: 'var(--primary)' }}>Cafe</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Customer Cash Receipt · Tax Invoice
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '8px', color: 'var(--text-main)' }}>
                Order #{selectedOrder.orderNumber}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {formatOrderDateTime(selectedOrder.createdAt)} · Cash Only
              </div>
            </div>

            {/* Itemized Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', zIndex: 1 }}>
              {selectedOrder.items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{i.name}</span> × {i.quantity}
                    {i.isAddOn && (
                      <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 800, marginLeft: '6px' }}>
                        (ADD-ON)
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: 700 }}>
                    Rs. {(i.unitPrice * i.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span>Rs. {selectedOrder.originalSubtotal.toLocaleString()}</span>
              </div>
              {selectedOrder.addOnSubtotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--primary)', fontWeight: 700 }}>
                  <span>Add-ons Subtotal</span>
                  <span>Rs. {selectedOrder.addOnSubtotal.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, marginTop: '4px' }}>
                <span>Total Amount Paid</span>
                <span style={{ color: 'var(--primary)' }}>Rs. {selectedOrder.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Cash Badge & Problem link */}
            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                <Banknote size={16} color="var(--primary)" />
                <span>Payment Method: CASH</span>
              </div>
              <span style={{ color: '#16A34A', fontWeight: 800 }}>✓ Settled</span>
            </div>

            {/* Bottom Row: Replaces previous 'full itemised receipt' with Reorder button */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', position: 'relative', zIndex: 1 }}>
              <button
                type="button"
                onClick={() => handleReorder(selectedOrder)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 850,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px var(--primary-glow)',
                  transition: 'all 0.15s ease',
                }}
              >
                <ArrowRight size={15} />
                <span>Reorder</span>
              </button>

              <button
                onClick={() => onNavigate('support')}
                style={{
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                }}
              >
                Report a problem with this order
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Media print style and custom scrollbars */}
      <style jsx>{`
        .foodies-history-left-subcard::-webkit-scrollbar,
        .foodies-history-right-subcard::-webkit-scrollbar {
          width: 6px;
        }
        .foodies-history-left-subcard::-webkit-scrollbar-track,
        .foodies-history-right-subcard::-webkit-scrollbar-track {
          background: transparent;
        }
        .foodies-history-left-subcard::-webkit-scrollbar-thumb,
        .foodies-history-right-subcard::-webkit-scrollbar-thumb {
          background-color: var(--border-color);
          border-radius: 999px;
        }
        .foodies-history-left-subcard::-webkit-scrollbar-thumb:hover,
        .foodies-history-right-subcard::-webkit-scrollbar-thumb:hover {
          background-color: var(--text-muted);
        }

        @media (max-width: 900px) {
          .foodies-order-history-view {
            height: auto !important;
            overflow: visible !important;
            padding-bottom: 80px !important;
          }
          .foodies-history-master-layout {
            grid-template-columns: 1fr !important;
            height: auto !important;
            overflow: visible !important;
          }
          .foodies-history-left-subcard {
            max-height: 280px !important;
            overflow-y: auto !important;
          }
          .foodies-history-right-subcard {
            height: auto !important;
            max-height: none !important;
            overflow-y: visible !important;
          }
        }

        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 4mm 2mm !important;
            width: 80mm !important;
            background: #FFFFFF !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-order-receipt,
          #printable-order-receipt * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-order-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 16px 12px !important;
            border: 1px dashed #CBD5E1 !important;
            border-radius: 6px !important;
            box-shadow: none !important;
            background: #FFFFFF !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
