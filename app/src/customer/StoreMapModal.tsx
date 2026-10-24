'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Branch } from '@/types/cafe';
import {
  MapPin,
  X,
  Navigation,
  Compass,
  Check,
  Edit,
  ExternalLink,
  Phone,
  Clock,
  Building,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Save,
  ArrowRight,
  Bike,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';

interface StoreMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderType?: 'dine_in' | 'takeaway' | 'delivery';
  onProceedToPayment?: () => void;
  startInEditMode?: boolean;
  initialEditingBranchId?: string;
}

// Haversine distance calculator in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Default fallback coordinates in Pakistan (Lahore)
const DEFAULT_USER_COORDS = { lat: 31.5204, lng: 74.3587 };

export const StoreMapModal: React.FC<StoreMapModalProps> = ({
  isOpen,
  onClose,
  orderType = 'delivery',
  onProceedToPayment,
  startInEditMode = false,
  initialEditingBranchId,
}) => {
  const {
    branches,
    currentBranchId,
    setCurrentBranchId,
    currentUser,
    currentRole,
    updateBranchSettings,
    addToast,
  } = useApp();

  // Active fulfillment type preview (delivery vs takeaway/dine_in)
  const [activeOrderType, setActiveOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>(orderType);

  useEffect(() => {
    setActiveOrderType(orderType);
  }, [orderType]);

  // User location state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('Detecting location...');

  // Active selected branch in the modal
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentBranchId || branches[0]?.id || '');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Map interactive state (zoom & pan)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Manager / Owner branch location editing state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    latitude: 31.5126,
    longitude: 74.3436,
  });

  // Role permissions check: platform_owner or branch_manager can edit branch location
  const isManagerOrOwner =
    currentUser?.role === 'platform_owner' ||
    currentUser?.role === 'branch_manager' ||
    currentRole === 'platform_owner' ||
    currentRole === 'branch_manager';

  // Open straight to edit mode if requested and authorized
  useEffect(() => {
    if (!isOpen) {
      setEditingBranch(null);
      return;
    }

    if (startInEditMode && isManagerOrOwner) {
      const target =
        (initialEditingBranchId && branches.find((b) => b.id === initialEditingBranchId)) ||
        (selectedBranchId && branches.find((b) => b.id === selectedBranchId)) ||
        (currentBranchId && branches.find((b) => b.id === currentBranchId)) ||
        branches[0];
      if (target) {
        setEditingBranch(target);
        setEditForm({
          name: target.name,
          city: target.city,
          address: target.address,
          phone: target.phone,
          latitude:
            target.latitude ??
            (target.city === 'Islamabad' ? 33.7215 : target.city === 'Karachi' ? 24.8252 : 31.5126),
          longitude:
            target.longitude ??
            (target.city === 'Islamabad' ? 73.0552 : target.city === 'Karachi' ? 67.0305 : 74.3436),
        });
      }
    }
  }, [isOpen, startInEditMode, initialEditingBranchId, isManagerOrOwner, selectedBranchId, currentBranchId, branches]);

  // Request user geolocation when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (currentBranchId) {
      setSelectedBranchId(currentBranchId);
    }

    if ('geolocation' in navigator) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserCoords(coords);
          setLocating(false);
          setLocationStatus('GPS Active');
        },
        () => {
          setUserCoords(DEFAULT_USER_COORDS);
          setLocating(false);
          setLocationStatus('Default Location (Lahore)');
        },
        { timeout: 7000, enableHighAccuracy: true }
      );
    } else {
      setUserCoords(DEFAULT_USER_COORDS);
      setLocationStatus('Standard Location');
    }
  }, [isOpen, currentBranchId]);

  // Compute distances to all branches from user's coordinates
  const branchesWithDistance = useMemo(() => {
    const coords = userCoords || DEFAULT_USER_COORDS;
    return branches.map((b) => {
      const bLat = b.latitude ?? (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126);
      const bLng = b.longitude ?? (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436);
      const distance = calculateDistanceKm(coords.lat, coords.lng, bLat, bLng);
      return {
        ...b,
        resolvedLat: bLat,
        resolvedLng: bLng,
        distanceKm: distance,
      };
    });
  }, [branches, userCoords]);

  // Identify nearest branch automatically
  const nearestBranch = useMemo(() => {
    if (branchesWithDistance.length === 0) return null;
    return [...branchesWithDistance].sort((a, b) => a.distanceKm - b.distanceKm)[0];
  }, [branchesWithDistance]);

  // Filtered branches for search
  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branchesWithDistance;
    const q = searchQuery.toLowerCase();
    return branchesWithDistance.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q)
    );
  }, [branchesWithDistance, searchQuery]);

  // Currently selected branch object
  const activeBranch = useMemo(() => {
    return (
      branchesWithDistance.find((b) => b.id === selectedBranchId) ||
      branchesWithDistance[0] ||
      null
    );
  }, [branchesWithDistance, selectedBranchId]);

  // Auto-select nearest branch upon initial detection
  useEffect(() => {
    if (nearestBranch && !selectedBranchId) {
      setSelectedBranchId(nearestBranch.id);
    }
  }, [nearestBranch, selectedBranchId]);

  if (!isOpen) return null;

  // Handlers
  const handleSelectBranch = (bId: string) => {
    setSelectedBranchId(bId);
    setCurrentBranchId(bId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('foodies_customer_branch', bId);
      localStorage.setItem('foodies_customer_manual_branch', bId);
    }
    const b = branches.find((item) => item.id === bId);
    addToast({
      type: 'success',
      title: 'Branch Selected! 📍',
      message: `Now ordering from ${b?.name || 'this branch'}.`,
    });
  };

  const handleStartEdit = (b: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isManagerOrOwner) return;

    setEditingBranch(b);
    setEditForm({
      name: b.name,
      city: b.city,
      address: b.address,
      phone: b.phone,
      latitude: b.latitude ?? (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126),
      longitude: b.longitude ?? (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436),
    });
  };

  const handleSaveBranchLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch || !isManagerOrOwner) return;

    updateBranchSettings(editingBranch.id, {
      name: editForm.name.trim(),
      city: editForm.city.trim(),
      address: editForm.address.trim(),
      phone: editForm.phone.trim(),
      latitude: Number(editForm.latitude),
      longitude: Number(editForm.longitude),
    });

    addToast({
      type: 'success',
      title: 'Branch Location Updated 📍',
      message: `${editForm.name} location details saved.`,
    });

    setEditingBranch(null);
  };

  // Map panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetMap = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Map coordinate normalization
  const mapWidth = 600;
  const mapHeight = 380;

  const projectCoords = (lat: number, lng: number) => {
    const minLat = 24.0;
    const maxLat = 34.5;
    const minLng = 66.5;
    const maxLng = 75.2;

    const xRatio = (lng - minLng) / (maxLng - minLng);
    const yRatio = (lat - minLat) / (maxLat - minLat);

    const padding = 45;
    const x = padding + xRatio * (mapWidth - padding * 2);
    const y = mapHeight - (padding + yRatio * (mapHeight - padding * 2));

    return { x, y };
  };

  const userPoint = userCoords ? projectCoords(userCoords.lat, userCoords.lng) : projectCoords(DEFAULT_USER_COORDS.lat, DEFAULT_USER_COORDS.lng);
  const activePoint = activeBranch ? projectCoords(activeBranch.resolvedLat, activeBranch.resolvedLng) : null;

  // DIRECTION LINE LOGIC PER USER REQUIREMENT:
  // - If delivery: Direction line points TO YOU (from Branch to You)
  // - If takeaway or dine-in: Direction line points FROM YOU TO BRANCH
  const isDelivery = activeOrderType === 'delivery';
  const lineStart = isDelivery ? activePoint : userPoint;
  const lineEnd = isDelivery ? userPoint : activePoint;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 12, 10, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      {/* Modal Dialog Container - Compact Checkout Size per requirement */}
      <div
        style={{
          position: 'relative',
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          width: 'clamp(320px, 94vw, 700px)',
          height: 'clamp(420px, 68vh, 520px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* ============ COMPACT MODAL TOP HEADER ============ */}
        <div
          style={{
            padding: '10px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card-subtle)',
            flexShrink: 0,
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: 'rgba(217, 101, 40, 0.12)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Navigation size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap' }}>
                  Branch Locator & Route
                </h3>
                {nearestBranch && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 900,
                      padding: '1px 6px',
                      borderRadius: '8px',
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                    }}
                  >
                    Nearest: {nearestBranch.city}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Select a store to view its location, distance, and direct navigation
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ============ MODAL BODY (1/4 Left Side & 3/4 Right Side) ============ */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* 
            ========================================================================
            LEFT 1 QUARTER (~28% width): SCROLLABLE LIST OF BRANCH NAMES
            With location address below the name in less bold words
            ========================================================================
          */}
          <div
            style={{
              width: 'clamp(180px, 28%, 215px)',
              borderRight: '1px solid var(--border-color)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Search filter input */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)' }}>
              <input
                type="text"
                placeholder="Search branches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '11px',
                  color: 'var(--text-main)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Scrollable list of branches */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {filteredBranches.map((b) => {
                const isSelected = b.id === selectedBranchId;
                const isCurrentActive = b.id === currentBranchId;
                const isNearest = nearestBranch?.id === b.id;

                return (
                  <div
                    key={b.id}
                    onClick={() => handleSelectBranch(b.id)}
                    style={{
                      padding: '10px',
                      borderRadius: '12px',
                      border: isSelected
                        ? '1.5px solid var(--primary)'
                        : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(217, 101, 40, 0.05)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                        {b.city}
                      </span>
                      {isNearest && (
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 900,
                            padding: '1px 5px',
                            borderRadius: '8px',
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                          }}
                        >
                          ⚡ Nearest
                        </span>
                      )}
                    </div>

                    {/* Branch Name in BOLD */}
                    <div
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 850,
                        color: 'var(--text-main)',
                        lineHeight: 1.2,
                      }}
                    >
                      {b.name}
                    </div>

                    {/* Location Address below the name in LESS BOLD words */}
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 450,
                        color: 'var(--text-muted)',
                        lineHeight: 1.35,
                      }}
                    >
                      {b.address}
                    </div>

                    {/* Distance indicator */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', fontSize: '10.5px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
                        📍 {b.distanceKm} km
                      </span>
                      {isCurrentActive && (
                        <span style={{ color: '#15803D', fontWeight: 800 }}>
                          ✓ Active
                        </span>
                      )}
                    </div>

                    {/* Manager/Owner Edit button */}
                    {isManagerOrOwner && (
                      <button
                        type="button"
                        onClick={(e) => handleStartEdit(b, e)}
                        style={{
                          marginTop: '4px',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(124, 58, 237, 0.08)',
                          color: '#7C3AED',
                          border: '1px solid rgba(124, 58, 237, 0.25)',
                          fontSize: '10px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                        }}
                      >
                        <Edit size={10} />
                        <span>Edit Location</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 
            ========================================================================
            RIGHT 3 QUARTERS (~72% width): INTERACTIVE MAP VIEW
            Showing current location, that branch location, and directional route line
            ========================================================================
          */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#F7F6F1',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              userSelect: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Zoom / Control Buttons */}
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.2))}
                title="Zoom In"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                }}
              >
                <ZoomIn size={14} />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.7))}
                title="Zoom Out"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                }}
              >
                <ZoomOut size={14} />
              </button>
              <button
                type="button"
                onClick={handleResetMap}
                title="Reset View"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                }}
              >
                <RotateCcw size={12} />
              </button>
            </div>

            {/* Interactive Vector Map */}
            <div
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isDragging ? 'grabbing' : 'grab',
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              <svg
                viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                style={{ width: '100%', height: '100%', maxWidth: `${mapWidth}px`, maxHeight: `${mapHeight}px` }}
              >
                <defs>
                  <pattern id="compactGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#EBE8DE" strokeWidth="0.8" />
                  </pattern>

                  {/* Gradient for trajectory route */}
                  <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isDelivery ? 'var(--primary)' : '#2563EB'} />
                    <stop offset="100%" stopColor={isDelivery ? '#2563EB' : 'var(--primary)'} />
                  </linearGradient>

                  {/* Arrowhead marker pointing to Customer (Delivery) */}
                  <marker
                    id="arrowToCustomer"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB" />
                  </marker>

                  {/* Arrowhead marker pointing to Branch (Takeaway/Dine-In) */}
                  <marker
                    id="arrowToBranch"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--primary)" />
                  </marker>
                </defs>

                <rect width={mapWidth} height={mapHeight} fill="#F7F6F1" />
                <rect width={mapWidth} height={mapHeight} fill="url(#compactGrid)" />

                {/* Major routes matching checkout vector design */}
                <path d="M 60 220 Q 140 180 230 140 T 360 80" fill="none" stroke="#E3DFD5" strokeWidth="6" strokeLinecap="round" />

                {/* City Labels */}
                <text x="90" y="210" fill="#BFBBAE" fontSize="9" fontWeight="800">KARACHI</text>
                <text x="250" y="130" fill="#BFBBAE" fontSize="9" fontWeight="800">LAHORE</text>
                <text x="360" y="60" fill="#BFBBAE" fontSize="9" fontWeight="800">ISLAMABAD</text>

                {/* DIRECTIONAL ROUTE LINE */}
                {lineStart && lineEnd && (
                  <g>
                    {/* Shadow line */}
                    <line
                      x1={lineStart.x}
                      y1={lineStart.y}
                      x2={lineEnd.x}
                      y2={lineEnd.y}
                      stroke="rgba(0, 0, 0, 0.06)"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />

                    {/* Animated directional dashed line with arrowhead */}
                    <line
                      x1={lineStart.x}
                      y1={lineStart.y}
                      x2={lineEnd.x}
                      y2={lineEnd.y}
                      stroke="url(#routeGrad)"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      strokeLinecap="round"
                      markerEnd={isDelivery ? 'url(#arrowToCustomer)' : 'url(#arrowToBranch)'}
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="20"
                        to="0"
                        dur="1.2s"
                        repeatCount="indefinite"
                      />
                    </line>

                    {/* Midpoint Directional Badge */}
                    <g transform={`translate(${(lineStart.x + lineEnd.x) / 2}, ${(lineStart.y + lineEnd.y) / 2 - 8})`}>
                      <rect x="-65" y="-10" width="130" height="20" rx="10" fill="#FFFFFF" stroke="var(--border-color)" strokeWidth="1" />
                      <text x="0" y="4" textAnchor="middle" fill="var(--text-main)" fontSize="9" fontWeight="900">
                        {isDelivery
                          ? `Branch ➔ You (${activeBranch?.distanceKm} km)`
                          : `You ➔ Branch (${activeBranch?.distanceKm} km)`}
                      </text>
                    </g>
                  </g>
                )}

                {/* Other Branch Pins */}
                {branchesWithDistance.map((b) => {
                  if (b.id === selectedBranchId) return null;
                  const pt = projectCoords(b.resolvedLat, b.resolvedLng);
                  return (
                    <g key={`pin-${b.id}`} transform={`translate(${pt.x}, ${pt.y})`} onClick={() => handleSelectBranch(b.id)} style={{ cursor: 'pointer' }}>
                      <circle r="9" fill="#FFFFFF" stroke="var(--border-color)" strokeWidth="1.5" />
                      <circle r="4" fill="var(--text-muted)" />
                      <text x="0" y="16" textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="800">
                        {b.city}
                      </text>
                    </g>
                  );
                })}

                {/* Customer Pin (Blue Radar Pin from checkout) */}
                {userPoint && (
                  <g transform={`translate(${userPoint.x}, ${userPoint.y})`}>
                    <circle r="14" fill="rgba(37, 99, 235, 0.2)">
                      <animate attributeName="r" from="8" to="18" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.7" to="0" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />
                    <g transform="translate(0, -12)">
                      <rect x="-30" y="-8" width="60" height="15" rx="7" fill="#2563EB" />
                      <text x="0" y="2.5" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900">
                        YOU (DEST)
                      </text>
                    </g>
                  </g>
                )}

                {/* Selected Branch Pin (Orange Pin from checkout) */}
                {activePoint && activeBranch && (
                  <g transform={`translate(${activePoint.x}, ${activePoint.y})`}>
                    <path d="M 0 0 C -8 -10 -9 -20 0 -28 C 9 -20 8 -10 0 0 Z" fill="var(--primary)" stroke="#FFFFFF" strokeWidth="1.5" />
                    <circle cx="0" cy="-18" r="5" fill="#FFFFFF" />
                    <text x="0" y="-15" textAnchor="middle" fontSize="7">☕</text>
                    <g transform="translate(0, 10)">
                      <rect x="-42" y="0" width="84" height="16" rx="5" fill="#FFFFFF" stroke="var(--primary)" strokeWidth="1" />
                      <text x="0" y="10.5" textAnchor="middle" fill="var(--text-main)" fontSize="8" fontWeight="900">
                        {activeBranch.city} Branch
                      </text>
                    </g>
                  </g>
                )}
              </svg>
            </div>

            {/* Compact Floating Branch Details Overlay at bottom of map */}
            {activeBranch && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '8px',
                  right: '8px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  zIndex: 30,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 850, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {activeBranch.name}
                    </span>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--primary)' }}>
                      • {activeBranch.distanceKm} km
                    </span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeBranch.address}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activeBranch.resolvedLat},${activeBranch.resolvedLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 750,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>Directions</span>
                  </a>

                  {onProceedToPayment ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectBranch(activeBranch.id);
                        onProceedToPayment();
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '11.5px',
                        fontWeight: 850,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>Proceed to Payment</span>
                      <ArrowRight size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectBranch(activeBranch.id);
                        onClose();
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--primary)',
                        color: '#000000',
                        border: 'none',
                        fontSize: '11.5px',
                        fontWeight: 850,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Check size={13} />
                      <span>{currentBranchId === activeBranch.id ? 'Selected' : 'Select Branch'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OWNER & MANAGER EDIT BRANCH LOCATION MODAL */}
        {editingBranch && isManagerOrOwner && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100000,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
                maxWidth: '460px',
                width: '100%',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(124, 58, 237, 0.1)',
                      color: '#7C3AED',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Edit size={16} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                      Edit Branch Location
                    </h4>
                    <span style={{ fontSize: '10.5px', color: '#7C3AED', fontWeight: 700 }}>
                      Owner & Manager Permission Verified
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveBranchLocation} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                    Branch Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '12.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                      City
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.city}
                      onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                      Phone
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                    Physical Address
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editForm.address}
                    onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '12.5px',
                      boxSizing: 'border-box',
                      resize: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={editForm.latitude}
                      onChange={(e) => setEditForm((f) => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={editForm.longitude}
                      onChange={(e) => setEditForm((f) => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingBranch(null)}
                    style={{
                      flex: 1,
                      padding: '9px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '9px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: 'var(--primary)',
                      color: '#000000',
                      fontWeight: 850,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <Save size={13} />
                    <span>Save Location</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
