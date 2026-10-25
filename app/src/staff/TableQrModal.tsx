'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Table, TableStatus } from '@/types/cafe';
import { TableQrCodeSvg } from '@/components/common/TableQrCodeSvg';
import {
  QrCode,
  X,
  Clock,
  CheckCircle,
  Copy,
  Printer,
  Smartphone,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Check,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface TableQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateCustomerScan?: (tableNumber: string) => void;
}

export const TableQrModal: React.FC<TableQrModalProps> = ({
  isOpen,
  onClose,
  onSimulateCustomerScan,
}) => {
  const {
    currentBranch,
    tables,
    generateTableQr,
    toggleTableQrAllowReserved,
    addToast,
  } = useApp();

  const branchTables = useMemo(() => {
    return tables.filter(
      (t) => !t.branchId || t.branchId === currentBranch.id
    );
  }, [tables, currentBranch.id]);

  const [selectedTableId, setSelectedTableId] = useState<string>(
    branchTables[0]?.id || ''
  );
  const [selectedDurationMin, setSelectedDurationMin] = useState<number>(60);
  const [customMinInput, setCustomMinInput] = useState<string>('90');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Active table
  const activeTable = useMemo(() => {
    return branchTables.find((t) => t.id === selectedTableId) || branchTables[0];
  }, [branchTables, selectedTableId]);

  if (!isOpen) return null;

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://foodiescafe.pk';

  const customerQrUrl = activeTable
    ? `${origin}/?tableQr=${encodeURIComponent(activeTable.number)}&branch=${encodeURIComponent(currentBranch.id)}&token=${encodeURIComponent(activeTable.qrCode || `QR-${activeTable.number}`)}`
    : '';

  const handleGenerateQr = async () => {
    if (!activeTable) return;
    setIsGenerating(true);
    const duration =
      selectedDurationMin === -1 ? Number(customMinInput) || 60 : selectedDurationMin;
    await generateTableQr(
      activeTable.id,
      duration,
      activeTable.allowQrOrderOnReserved ?? false
    );
    setIsGenerating(false);
  };

  const handleToggleAllowReserved = async () => {
    if (!activeTable) return;
    const current = activeTable.allowQrOrderOnReserved ?? false;
    await toggleTableQrAllowReserved(activeTable.id, !current);
  };

  const handleCopyLink = () => {
    if (!customerQrUrl) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(customerQrUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      addToast({
        type: 'success',
        title: 'Table QR Link Copied 📋',
        message: `Direct link for Table ${activeTable?.number} copied to clipboard!`,
      });
    }
  };

  const handlePrintTentCard = () => {
    if (typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>FoodiesCafe Table Tent Card - ${activeTable?.number}</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  text-align: center;
                  padding: 40px;
                  color: #0F0C0A;
                }
                .card {
                  max-width: 380px;
                  margin: 0 auto;
                  border: 2px solid #EA580C;
                  border-radius: 16px;
                  padding: 24px;
                  box-shadow: 0 4px 14px rgba(0,0,0,0.1);
                }
                .logo { font-size: 20px; font-weight: 900; color: #EA580C; letter-spacing: 1px; }
                .table-num { font-size: 38px; font-weight: 900; margin: 8px 0; color: #0F0C0A; }
                .sub { font-size: 13px; color: #64748B; margin-bottom: 20px; }
                .instructions { font-size: 13px; font-weight: 700; margin-top: 18px; line-height: 1.5; }
                .wifi { margin-top: 16px; font-size: 11px; color: #94A3B8; }
                @media print {
                  button { display: none; }
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="logo">FOODIES CAFE</div>
                <div class="table-num">TABLE ${activeTable?.number}</div>
                <div class="sub">${activeTable?.floor || 'Main Dining Hall'} · ${currentBranch.name}</div>
                <div style="margin: 16px 0;">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(customerQrUrl)}" width="200" height="200" style="display: block; margin: 0 auto; border-radius: 8px;" />
                </div>
                <div class="instructions">
                  📱 <strong>SCAN WITH YOUR PHONE CAMERA</strong><br/>
                  Browse fresh food menu & order directly to this table!
                </div>
                <div class="wifi">
                  📶 Free Guest Wi-Fi: <strong>FoodiesCafe-Guest</strong> · Pass: <strong>foodies123</strong>
                </div>
              </div>
              <script>
                window.onload = function() { window.print(); }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return { label: 'AVAILABLE', bg: '#DCFCE7', text: '#166534', border: '#86EFAC' };
      case 'reserved':
        return { label: 'RESERVED', bg: '#F3E8FF', text: '#6B21A8', border: '#D8B4FE' };
      case 'occupied':
        return { label: 'OCCUPIED', bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' };
      case 'cleaning':
        return { label: 'CLEANING', bg: '#FEF9C3', text: '#854D0E', border: '#FDE047' };
      default:
        return { label: status.toUpperCase(), bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 12, 10, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(234, 88, 12, 0.1)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QrCode size={20} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--text-main)',
                  lineHeight: 1.2,
                }}
              >
                Table QR Codes
              </h2>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {currentBranch.name} · Generate time-limited QR codes with in-store reservation bypass
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Left Column: Table Selection & Time Parameters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Table Selection Pills */}
            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                1. Select Table ({branchTables.length} Tables Available):
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                  gap: '8px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {branchTables.map((t) => {
                  const isSelected = (activeTable?.id || '') === t.id;
                  const statusStyle = getStatusBadge(t.status);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTableId(t.id)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '8px',
                        border: isSelected
                          ? '2px solid var(--primary)'
                          : '1px solid var(--border-color)',
                        backgroundColor: isSelected
                          ? 'rgba(234, 88, 12, 0.08)'
                          : 'var(--bg-card-subtle)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 850,
                          fontSize: '13px',
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                        }}
                      >
                        {t.number}
                      </div>
                      <div
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          marginTop: '3px',
                          display: 'inline-block',
                        }}
                      >
                        {statusStyle.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QR Validity Duration Selection */}
            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '8px',
                }}
              >
                <Clock size={14} color="var(--primary)" />
                <span>2. QR Code Validity Time Window:</span>
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                  gap: '6px',
                }}
              >
                {[
                  { label: '30 Mins', mins: 30 },
                  { label: '1 Hour', mins: 60 },
                  { label: '2 Hours', mins: 120 },
                  { label: '4 Hours', mins: 240 },
                  { label: 'Full Shift (8h)', mins: 480 },
                ].map((item) => (
                  <button
                    key={item.mins}
                    type="button"
                    onClick={() => setSelectedDurationMin(item.mins)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border:
                        selectedDurationMin === item.mins
                          ? '2px solid var(--primary)'
                          : '1px solid var(--border-color)',
                      backgroundColor:
                        selectedDurationMin === item.mins
                          ? 'var(--primary)'
                          : 'var(--bg-card-subtle)',
                      color:
                        selectedDurationMin === item.mins ? '#FFFFFF' : 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CASHIER FEATURE TOGGLE: ALLOW ORDERING ON ALREADY RESERVED TABLE */}
            <div
              style={{
                backgroundColor: activeTable?.allowQrOrderOnReserved
                  ? 'rgba(34, 197, 94, 0.08)'
                  : 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-md)',
                border: activeTable?.allowQrOrderOnReserved
                  ? '1.5px solid #22C55E'
                  : '1px solid var(--border-color)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck
                    size={18}
                    color={activeTable?.allowQrOrderOnReserved ? '#16A34A' : 'var(--text-muted)'}
                  />
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: '13px',
                      color: 'var(--text-main)',
                    }}
                  >
                    Allow Ordering on Reserved Table
                  </span>
                </div>

                {/* Switch Toggle */}
                <button
                  type="button"
                  onClick={handleToggleAllowReserved}
                  style={{
                    width: '46px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: activeTable?.allowQrOrderOnReserved
                      ? '#16A34A'
                      : 'var(--border-color)',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    padding: '2px',
                  }}
                  title="Toggle reservation override permission"
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      transform: activeTable?.allowQrOrderOnReserved
                        ? 'translateX(22px)'
                        : 'translateX(0)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>
              </div>

              <p
                style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.45,
                }}
              >
                {activeTable?.allowQrOrderOnReserved ? (
                  <span style={{ color: '#166534', fontWeight: 650 }}>
                    🟢 <strong>ENABLED:</strong> If Table {activeTable?.number} is reserved online, a customer scanning this physical QR code will see a Reserved notice with an option to <strong>Ignore & Continue Ordering</strong> for in-store dining.
                  </span>
                ) : (
                  <span>
                    🔒 <strong>DISABLED:</strong> If Table {activeTable?.number} is reserved, customers scanning this QR code cannot ignore the reservation and must choose another table.
                  </span>
                )}
              </p>
            </div>

            {/* Action to Generate / Refresh QR */}
            <button
              type="button"
              onClick={handleGenerateQr}
              disabled={isGenerating}
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px var(--primary-glow)',
              }}
            >
              <Sparkles size={16} />
              <span>{isGenerating ? 'Generating...' : `Generate Special QR Code for ${activeTable?.number || 'Table'}`}</span>
            </button>
          </div>

          {/* Right Column: Visual QR Code & Action Controls */}
          <div
            style={{
              backgroundColor: 'var(--bg-card-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              textAlign: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 900,
                  color: 'var(--text-main)',
                  marginBottom: '2px',
                }}
              >
                Table {activeTable?.number}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {activeTable?.floor || 'Ground Floor'} · Capacity: {activeTable?.capacity} Chairs
              </div>
            </div>

            {/* Crisp Vector QR Code Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <TableQrCodeSvg
                value={customerQrUrl || `FC-TABLE-${activeTable?.number}`}
                size={170}
                tableNumber={activeTable?.number}
                includeBranding={true}
              />

              {activeTable?.qrExpiresAt && (
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 750,
                    color: 'var(--primary)',
                    marginTop: '8px',
                    backgroundColor: 'rgba(234, 88, 12, 0.08)',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  ⏱️ Valid until: {new Date(activeTable.qrExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            {/* Scan URL String */}
            <div
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                padding: '8px 10px',
                border: '1px solid var(--border-color)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                wordBreak: 'break-all',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '2px' }}>
                Customer Scan URL:
              </div>
              {customerQrUrl}
            </div>

            {/* Action Buttons: Copy, Simulate Scan, Print */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontWeight: 750,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {copiedLink ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onSimulateCustomerScan && activeTable) {
                    onSimulateCustomerScan(activeTable.number);
                  } else if (typeof window !== 'undefined' && activeTable) {
                    window.location.href = `/?tableQr=${encodeURIComponent(activeTable.number)}`;
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: '130px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                title="Test customer view immediately"
              >
                <Smartphone size={14} />
                <span>Simulate Scan 📱</span>
              </button>

              <button
                type="button"
                onClick={handlePrintTentCard}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontWeight: 750,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Printer size={14} color="var(--primary)" />
                <span>Print Table QR Tent Card 🖨️</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
