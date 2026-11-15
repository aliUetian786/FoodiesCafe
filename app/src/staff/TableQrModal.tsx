'use client';

import React, { useState, useMemo } from 'react';
import QRCode from 'qrcode';
import { useApp } from '@/context/AppContext';
import { Table, TableStatus, normalizeBranchId } from '@/types/cafe';
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
  Download,
  Globe,
  Edit2,
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
    addTable,
    deleteTable,
  } = useApp();

  const normBranchId = normalizeBranchId(currentBranch.id);
  const branchTables = useMemo(() => {
    return tables.filter(
      (t) => !t.branchId || t.branchId === currentBranch.id || normalizeBranchId(t.branchId) === normBranchId
    );
  }, [tables, currentBranch.id, normBranchId]);

  const [selectedTableId, setSelectedTableId] = useState<string>(
    branchTables[0]?.id || ''
  );
  const [showAddTableForm, setShowAddTableForm] = useState(false);
  const [newTableNum, setNewTableNum] = useState('');
  const [newTableCap, setNewTableCap] = useState(4);
  const [newTableFloor, setNewTableFloor] = useState('Ground Floor');
  const [selectedDurationMin, setSelectedDurationMin] = useState<number>(60);
  const [customMinInput, setCustomMinInput] = useState<string>('90');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeBranding, setIncludeBranding] = useState<boolean>(true);

  // Persistent custom origin/host setting for QR code links
  const [customOrigin, setCustomOrigin] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('foodies_qr_custom_origin');
      if (saved) {
        if (saved.includes('localhost') && !window.location.origin.includes('localhost')) {
          return window.location.origin;
        }
        return saved;
      }
      return window.location.origin;
    }
    return 'https://foodiescafe.pk';
  });
  const [isEditingOrigin, setIsEditingOrigin] = useState(false);
  const [originInput, setOriginInput] = useState('');

  // Persistent override cache so user toggle is never wiped by background sync
  const [allowReservedOverrides, setAllowReservedOverrides] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_allow_reserved_overrides');
        if (saved) return JSON.parse(saved);
      } catch { }
    }
    return {};
  });

  // Active table
  const activeTable = useMemo(() => {
    return branchTables.find((t) => t.id === selectedTableId) || branchTables[0];
  }, [branchTables, selectedTableId]);

  const isAllowReserved = useMemo(() => {
    if (!activeTable) return false;
    if (allowReservedOverrides[activeTable.id] !== undefined) {
      return allowReservedOverrides[activeTable.id];
    }
    return Boolean(activeTable.allowQrOrderOnReserved);
  }, [activeTable, allowReservedOverrides]);

  if (!isOpen) return null;

  const detectedOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://foodiescafe.pk';
  const effectiveOrigin = (customOrigin || detectedOrigin).replace(/\/+$/, '');

  const customerQrUrl = activeTable
    ? `${effectiveOrigin}/?tableQr=${encodeURIComponent(activeTable.number)}&branch=${encodeURIComponent(currentBranch.id)}&token=${encodeURIComponent(activeTable.qrCode || `QR-${activeTable.number}`)}`
    : '';

  const handleGenerateQr = async () => {
    if (!activeTable) return;
    setIsGenerating(true);
    const duration =
      selectedDurationMin === -1 ? Number(customMinInput) || 60 : selectedDurationMin;
    await generateTableQr(
      activeTable.id,
      duration,
      isAllowReserved
    );
    setIsGenerating(false);
  };

  const handleToggleAllowReserved = async () => {
    if (!activeTable) return;
    const nextVal = !isAllowReserved;
    setAllowReservedOverrides((prev) => {
      const next = { ...prev, [activeTable.id]: nextVal };
      if (typeof window !== 'undefined') {
        localStorage.setItem('foodies_allow_reserved_overrides', JSON.stringify(next));
      }
      return next;
    });
    await toggleTableQrAllowReserved(activeTable.id, nextVal);
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

  const handleDownloadPng = async () => {
    if (!customerQrUrl || !activeTable) return;
    try {
      const dataUrl = await QRCode.toDataURL(customerQrUrl, {
        errorCorrectionLevel: 'H',
        margin: 3,
        width: 600,
        color: { dark: '#0F0C0A', light: '#FFFFFF' },
      });
      const a = document.createElement('a');
      a.download = `FoodiesCafe-Table-${activeTable.number}-QR.png`;
      a.href = dataUrl;
      a.click();
      addToast({
        type: 'success',
        title: 'QR Code Saved! 💾',
        message: `High-resolution PNG downloaded for Table ${activeTable.number}. Ready to print or scan!`,
      });
    } catch (err) {
      console.error('Download QR PNG error:', err);
    }
  };

  const handlePrintTentCard = async () => {
    if (typeof window !== 'undefined' && activeTable && customerQrUrl) {
      try {
        const qrDataUrl = await QRCode.toDataURL(customerQrUrl, {
          errorCorrectionLevel: 'H',
          margin: 3,
          width: 450,
          color: { dark: '#0F0C0A', light: '#FFFFFF' },
        });

        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>FoodiesCafe Table Tent Card - ${activeTable.number}</title>
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
                  <div class="table-num">TABLE ${activeTable.number}</div>
                  <div class="sub">${activeTable.floor || 'Main Dining Hall'} · ${currentBranch.name}</div>
                  <div style="margin: 16px 0;">
                    <img src="${qrDataUrl}" width="200" height="200" alt="Table QR" style="display: block; margin: 0 auto; border-radius: 8px;" />
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
      } catch (err) {
        console.error('Failed to generate print tent card QR:', err);
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
      className="foodies-modal-overlay"
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
        className="foodies-modal-card"
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
                Tables & QR Code Management
              </h2>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {currentBranch.name} · Create new tables, delete tables, and generate in-store customer QR codes
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    margin: 0,
                  }}
                >
                  1. Select Table ({branchTables.length} Tables Available):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddTableForm(!showAddTableForm)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid var(--primary)',
                      backgroundColor: showAddTableForm ? 'var(--primary)' : 'rgba(234, 88, 12, 0.08)',
                      color: showAddTableForm ? '#FFFFFF' : 'var(--primary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <span>{showAddTableForm ? '✕ Close Form' : '+ Add New Table'}</span>
                  </button>
                  {activeTable && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete Table #${activeTable.number}? This will permanently remove it from the system.`)) {
                          deleteTable(activeTable.id);
                          const remaining = branchTables.filter((t) => t.id !== activeTable.id);
                          if (remaining.length > 0) {
                            setSelectedTableId(remaining[0].id);
                          }
                          addToast({
                            type: 'info',
                            title: 'Table Deleted',
                            message: `Table #${activeTable.number} was permanently removed.`,
                          });
                        }
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #EF4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        color: '#DC2626',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Permanently delete active table"
                    >
                      <span>🗑️ Delete Table #{activeTable.number}</span>
                    </button>
                  )}
                </div>
              </div>

              {showAddTableForm && (
                <div style={{ marginBottom: '12px', padding: '12px 14px', backgroundColor: 'var(--bg-card-subtle)', borderRadius: '10px', border: '1.5px solid var(--primary)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '10px', alignItems: 'end' }}>
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
                backgroundColor: isAllowReserved
                  ? 'rgba(34, 197, 94, 0.08)'
                  : 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-md)',
                border: isAllowReserved
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
                    color={isAllowReserved ? '#16A34A' : 'var(--text-muted)'}
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
                    backgroundColor: isAllowReserved
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
                      transform: isAllowReserved
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
                {isAllowReserved ? (
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
                value={customerQrUrl || `${effectiveOrigin}/?tableQr=${encodeURIComponent(activeTable?.number || '1')}&branch=${encodeURIComponent(currentBranch.id)}`}
                size={200}
                tableNumber={activeTable?.number}
                includeBranding={includeBranding}
              />

              {/* Branding and standard pills */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '10px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIncludeBranding((prev) => !prev)}
                  style={{
                    fontSize: '11px',
                    fontWeight: 750,
                    color: includeBranding ? 'var(--primary)' : 'var(--text-muted)',
                    backgroundColor: includeBranding ? 'rgba(234, 88, 12, 0.08)' : 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-full)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                  title="Toggle center Foodies branding badge"
                >
                  <span>Brand Badge: {includeBranding ? 'ON ✓' : 'OFF'}</span>
                </button>

                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 750,
                    color: '#15803D',
                    backgroundColor: '#DCFCE7',
                    border: '1px solid #86EFAC',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  ✓ ISO/IEC 18004 Standard
                </span>
              </div>

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

            {/* Scan URL String & Base Host Editor */}
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '3px',
                }}
              >
                <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>
                  Customer Scan URL:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingOrigin(!isEditingOrigin);
                    setOriginInput(customOrigin || detectedOrigin);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '10.5px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: 0,
                  }}
                >
                  <Edit2 size={10} />
                  <span>{isEditingOrigin ? 'Close' : 'Set Domain'}</span>
                </button>
              </div>

              {isEditingOrigin ? (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    type="text"
                    value={originInput}
                    onChange={(e) => setOriginInput(e.target.value)}
                    placeholder="https://your-domain.vercel.app"
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '11.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = originInput.trim();
                        if (trimmed) {
                          setCustomOrigin(trimmed);
                          if (typeof localStorage !== 'undefined') {
                            localStorage.setItem('foodies_qr_custom_origin', trimmed);
                          }
                        }
                        setIsEditingOrigin(false);
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                      }}
                    >
                      Save Domain
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomOrigin(detectedOrigin);
                        if (typeof localStorage !== 'undefined') {
                          localStorage.removeItem('foodies_qr_custom_origin');
                        }
                        setIsEditingOrigin(false);
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Reset to Detected
                    </button>
                  </div>
                </div>
              ) : (
                customerQrUrl
              )}
            </div>

            {/* Action Buttons: Copy, Download PNG, Simulate Scan, Print */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  flex: 1,
                  minWidth: '100px',
                  padding: '9px 10px',
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
                  gap: '5px',
                }}
              >
                {copiedLink ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPng}
                style={{
                  flex: 1,
                  minWidth: '115px',
                  padding: '9px 10px',
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
                  gap: '5px',
                }}
                title="Download high-resolution PNG image"
              >
                <Download size={14} color="var(--primary)" />
                <span>Save PNG 💾</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (activeTable && typeof window !== 'undefined') {
                    const simUrl =
                      customerQrUrl ||
                      `/?tableQr=${encodeURIComponent(activeTable.number)}&branch=${encodeURIComponent(currentBranch.id)}&token=${encodeURIComponent(activeTable.qrCode || `QR-${activeTable.number}`)}`;
                    window.open(simUrl, '_blank', 'noopener,noreferrer');
                    if (onSimulateCustomerScan) {
                      try {
                        onSimulateCustomerScan(activeTable.number);
                      } catch { }
                    }
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: '115px',
                  padding: '9px 10px',
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
                  gap: '5px',
                }}
                title="Test customer view immediately"
              >
                <Smartphone size={14} />
                <span>Simulate 📱</span>
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
