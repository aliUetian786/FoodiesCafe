'use client';

import React from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

interface ModalConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  details?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export const ModalConfirmation: React.FC<ModalConfirmationProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details,
  confirmText = 'Yes, confirm',
  cancelText = 'No, go back',
  isDanger = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: 'var(--text-main)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: isDanger ? 'var(--status-cancelled-bg)' : 'var(--primary-light)',
                color: isDanger ? 'var(--status-cancelled-text)' : 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isDanger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '14.5px', lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>
          {message}
        </p>

        {details && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px dashed var(--border-color)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-main)',
            }}
          >
            {details}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              flex: 1.2,
              padding: '11px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isDanger ? '#DC2626' : 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: isDanger ? '0 4px 12px rgba(220, 38, 38, 0.3)' : '0 4px 14px var(--primary-glow)',
              transition: 'all 0.15s ease',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
