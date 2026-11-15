import React from 'react';
import { AlertTriangle, X, ShoppingBag, Clock, User, Phone } from 'lucide-react';
import { Branch, Order } from '@/types/cafe';

interface BranchShutdownModalProps {
  isOpen: boolean;
  branch: Branch | null;
  pendingOrders: Order[];
  onCancelAction: () => void;
  onContinueProcessing: () => void;
  onCancelOrdersAndShut: () => void;
}

export function BranchShutdownModal({
  isOpen,
  branch,
  pendingOrders,
  onCancelAction,
  onContinueProcessing,
  onCancelOrdersAndShut,
}: BranchShutdownModalProps) {
  if (!isOpen || !branch) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 12, 10, 0.65)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onCancelAction}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          maxWidth: '720px',
          width: '100%',
          border: '1.5px solid rgba(220, 38, 38, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'customerPageTransition 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, #E5E7EB)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#FEE2E2',
                border: '1px solid #FCA5A5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#DC2626',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={22} strokeWidth={2.4} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 850,
                  color: '#991B1B',
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '-0.01em',
                }}
              >
                Branch Offline — Pending Orders Detected
              </h3>
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: '12.5px',
                  color: '#7F1D1D',
                  fontWeight: 500,
                }}
              >
                {branch.name} has {pendingOrders.length} active order{pendingOrders.length === 1 ? '' : 's'} in progress.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancelAction}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              color: 'var(--text-muted, #6B7280)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: '#FEF3C7',
              border: '1px solid #FDE68A',
              marginBottom: '14px',
              fontSize: '13px',
              color: '#92400E',
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            <strong>Warning:</strong> You are about to mark this branch <strong>OFFLINE</strong>. Please choose how to handle these pending orders:
          </div>

          <div
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: 'var(--text-muted, #6B7280)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
            }}
          >
            Pending Orders Awaiting Fulfillment ({pendingOrders.length}):
          </div>

          {/* Pending Orders List */}
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              borderRadius: '12px',
              border: '1px solid var(--border-color, #E5E7EB)',
              backgroundColor: 'var(--bg-card-subtle, #F9FAFB)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
            }}
          >
            {pendingOrders.map((ord) => {
              const statusColors: Record<string, { bg: string; text: string }> = {
                placed: { bg: '#DBEAFE', text: '#1E40AF' },
                accepted: { bg: '#E0E7FF', text: '#3730A3' },
                preparing: { bg: '#FEF3C7', text: '#92400E' },
                ready: { bg: '#DCFCE7', text: '#166534' },
                served: { bg: '#F3E8FF', text: '#6B21A8' },
                out_for_delivery: { bg: '#FFEDD5', text: '#9A3412' },
              };
              const col = statusColors[ord.status] || { bg: '#F3F4F6', text: '#374151' };

              return (
                <div
                  key={ord.id}
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '13px',
                        color: 'var(--text-main, #1F2937)',
                        fontFamily: 'monospace',
                      }}
                    >
                      #{ord.orderNumber}
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 750,
                        backgroundColor: '#F3F4F6',
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}
                    >
                      {ord.type.replace('_', ' ')}
                    </span>
                    <span
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--text-main, #1F2937)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ord.customerName}
                    </span>
                    {ord.customerPhone && (
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #6B7280)' }}>
                        ({ord.customerPhone})
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        backgroundColor: col.bg,
                        color: col.text,
                        textTransform: 'uppercase',
                      }}
                    >
                      {ord.status.replace('_', ' ')}
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '13px',
                        color: 'var(--text-main, #1F2937)',
                      }}
                    >
                      Rs. {ord.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer: 3 Options strictly displayed in ONE SINGLE HORIZONTAL LINE */}
        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--border-color, #E5E7EB)',
            backgroundColor: 'var(--bg-card-subtle, #F9FAFB)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'nowrap',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Option 1: Cancel */}
          <button
            type="button"
            onClick={onCancelAction}
            style={{
              flex: 0.9,
              padding: '11px 8px',
              borderRadius: '10px',
              border: '1.5px solid var(--border-color, #D1D5DB)',
              backgroundColor: '#FFFFFF',
              color: 'var(--text-main, #374151)',
              fontWeight: 750,
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'all 0.15s ease',
            }}
            title="Cancel shutdown action and keep branch online"
          >
            Cancel
          </button>

          {/* Option 2: Continue with orders to continue processing */}
          <button
            type="button"
            onClick={onContinueProcessing}
            style={{
              flex: 1.5,
              padding: '11px 8px',
              borderRadius: '10px',
              border: '1.5px solid #D97706',
              backgroundColor: '#F59E0B',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '11.5px',
              cursor: 'pointer',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.28)',
              transition: 'all 0.15s ease',
            }}
            title="Shut branch for new orders, but allow staff to finish processing current pending orders"
          >
            Continue with Orders to Process
          </button>

          {/* Option 3: Cancel orders and shut branch */}
          <button
            type="button"
            onClick={onCancelOrdersAndShut}
            style={{
              flex: 1.5,
              padding: '11px 8px',
              borderRadius: '10px',
              border: '1.5px solid #B91C1C',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '11.5px',
              cursor: 'pointer',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.28)',
              transition: 'all 0.15s ease',
            }}
            title="Cancel all pending orders and shut branch offline"
          >
            Cancel Orders & Shut Branch
          </button>
        </div>
      </div>
    </div>
  );
}
