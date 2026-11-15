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
  Save,
  ArrowRight,
  Bike,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';
import { OpenStreetMapView } from '@/components/common/OpenStreetMapView';
import {
  OsmMarkerItem,
  getOsmDirectionsUrl,
  reverseGeocodeOpenStreetMap,
} from '@/utils/openStreetMap';

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
    customerCoordinates,
    setCustomerCoordinates,
    selectedDeliveryAddress,
    setSelectedDeliveryAddress,
    savedAddresses,
  } = useApp();

  // Pakistani Locality Identifier for delivery pins
  const getLocationLabel = (lat: number, lng: number): string => {
    const lahoreDist = calculateDistanceKm(lat, lng, 31.5204, 74.3587);
    const islamabadDist = calculateDistanceKm(lat, lng, 33.6844, 73.0479);
    const karachiDist = calculateDistanceKm(lat, lng, 24.8607, 67.0011);

    if (lahoreDist < 25) {
      if (lat > 31.53) return 'Gulberg / Cantt, Lahore';
      if (lat < 31.48) return 'DHA / Model Town, Lahore';
      return 'Central Lahore Area';
    }
    if (islamabadDist < 25) {
      if (lat > 33.71) return 'Sector F-7 / Blue Area, Islamabad';
      if (lat < 33.65) return 'Rawalpindi / Islamabad Express';
      return 'Islamabad Metropolitan Area';
    }
    if (karachiDist < 30) {
      if (lat < 24.84) return 'Clifton / DHA Phase 5, Karachi';
      if (lat > 24.9) return 'Gulshan-e-Iqbal / PECHS, Karachi';
      return 'Karachi South Coast';
    }
    return `Custom Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
  };

  // Active fulfillment type preview (delivery vs takeaway/dine_in)
  const [activeOrderType, setActiveOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>(orderType);

  useEffect(() => {
    setActiveOrderType(orderType);
  }, [orderType]);

  // User location state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(customerCoordinates || null);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('Detecting location...');

  // Update user location handler, reverse-geocode via OpenStreetMap, store persistently, & auto-select nearest branch
  const handleUpdateLocation = (
    coords: { lat: number; lng: number },
    userAction = true,
    addressOverride?: string
  ) => {
    setUserCoords(coords);
    if (setCustomerCoordinates) setCustomerCoordinates(coords);
    if (typeof window !== 'undefined') {
      localStorage.setItem('foodies_customer_coordinates', JSON.stringify(coords));
    }

    if (addressOverride && addressOverride.trim()) {
      setSelectedDeliveryAddress(addressOverride.trim());
    } else if (userAction) {
      reverseGeocodeOpenStreetMap(coords.lat, coords.lng).then((geo) => {
        if (geo?.address) {
          setSelectedDeliveryAddress(geo.address);
        }
      }).catch(() => {});
    }

    // Auto-select nearest open branch based on the new location
    let nearest = branches.find((b) => b.isOpen) || branches[0];
    let minD = Infinity;
    branches.forEach((b) => {
      if (b.isOpen) {
        const bLat = b.latitude ?? (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126);
        const bLng = b.longitude ?? (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436);
        const d = calculateDistanceKm(coords.lat, coords.lng, bLat, bLng);
        if (d < minD) {
          minD = d;
          nearest = b;
        }
      }
    });

    if (nearest) {
      setSelectedBranchId(nearest.id);
      setCurrentBranchId(nearest.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('foodies_customer_branch', nearest.id);
        localStorage.setItem('foodies_customer_selected_branch', nearest.id);
      }
    }

    const area = addressOverride || getLocationLabel(coords.lat, coords.lng);
    setLocationStatus(area);

    if (userAction && nearest) {
      addToast({
        type: 'info',
        title: 'Location Stored on OpenStreetMap 📍',
        message: `${area}. Nearest branch (${nearest.name}) auto-selected.`,
      });
    }
  };

  // Active selected branch in the modal
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentBranchId || branches[0]?.id || '');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [mapZoom, setMapZoom] = useState(12);

  // Manager / Owner branch location editing state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    latitude: 31.5126,
    longitude: 74.3436,
    maxOrderDistanceKm: 50,
    tableQrMaxDistanceMeters: 300,
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
          maxOrderDistanceKm: target.maxOrderDistanceKm ?? 50,
          tableQrMaxDistanceMeters: target.tableQrMaxDistanceMeters ?? 300,
        });
      }
    }
  }, [isOpen, startInEditMode, initialEditingBranchId, isManagerOrOwner, selectedBranchId, currentBranchId, branches]);

  // Load stored customer coordinates or detect GPS when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (currentBranchId) {
      setSelectedBranchId(currentBranchId);
    }

    if (customerCoordinates && typeof customerCoordinates.lat === 'number' && typeof customerCoordinates.lng === 'number') {
      setUserCoords(customerCoordinates);
      setLocating(false);
      setLocationStatus(getLocationLabel(customerCoordinates.lat, customerCoordinates.lng));
      return;
    }

    if ('geolocation' in navigator) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          };
          setUserCoords(coords);
          setCustomerCoordinates(coords);
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
    const b = branches.find((item) => item.id === bId);
    if (b && !b.isOpen) {
      addToast({
        type: 'warning',
        title: 'Branch Closed / Offline',
        message: `${b.name} is currently Closed / Offline. You cannot proceed with this branch. Please choose an open branch.`,
      });
      return;
    }

    // Freedom to order from ANY branch of customer's choice
    setSelectedBranchId(bId);
    setCurrentBranchId(bId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('foodies_customer_branch', bId);
      localStorage.setItem('foodies_customer_manual_branch', bId);
      localStorage.setItem('foodies_customer_selected_branch', bId);
    }
    addToast({
      type: 'success',
      title: 'Branch Selected! 📍',
      message: `Now ordering from ${b?.name || 'this branch'}.`,
    });
  };

  const handleStartEdit = (b: Branch, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isManagerOrOwner || !b) return;

    setEditingBranch(b);
    setEditForm({
      name: b.name || '',
      city: b.city || '',
      address: b.address || '',
      phone: b.phone || '',
      latitude: Number(b.latitude) || (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126),
      longitude: Number(b.longitude) || (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436),
      maxOrderDistanceKm: b.maxOrderDistanceKm ?? 50,
      tableQrMaxDistanceMeters: b.tableQrMaxDistanceMeters ?? 300,
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
      maxOrderDistanceKm: Number(editForm.maxOrderDistanceKm) || 50,
      tableQrMaxDistanceMeters: Number(editForm.tableQrMaxDistanceMeters) || 300,
    });

    addToast({
      type: 'success',
      title: 'Branch Location Updated 📍',
      message: `${editForm.name} location & distance parameters saved.`,
    });

    setEditingBranch(null);
  };

  const isDelivery = activeOrderType === 'delivery';
  const effectiveUserCoords = userCoords || DEFAULT_USER_COORDS;

  const osmMarkers: OsmMarkerItem[] = useMemo(() => {
    const branchPins: OsmMarkerItem[] = branchesWithDistance.map((b) => ({
      id: b.id,
      lat: b.resolvedLat,
      lng: b.resolvedLng,
      title: `${b.name}`,
      subtitle: b.address,
      kind: b.id === selectedBranchId ? 'selected_branch' : 'branch',
      badgeText: `${b.distanceKm} km`,
    }));

    return [
      ...branchPins,
      {
        id: 'customer-current-loc',
        lat: effectiveUserCoords.lat,
        lng: effectiveUserCoords.lng,
        title: isDelivery ? 'Delivery Location' : 'Your Current Location',
        kind: 'customer',
        badgeText: 'You',
      },
    ];
  }, [branchesWithDistance, selectedBranchId, effectiveUserCoords.lat, effectiveUserCoords.lng, isDelivery]);

  const osmMapCenter = useMemo(() => {
    if (activeBranch) {
      return {
        lat: activeBranch.resolvedLat,
        lng: activeBranch.resolvedLng,
      };
    }
    return effectiveUserCoords;
  }, [activeBranch, effectiveUserCoords]);

  const osmRouteLine = useMemo(() => {
    if (!activeBranch) return null;
    const branchPoint = { lat: activeBranch.resolvedLat, lng: activeBranch.resolvedLng };
    return {
      from: isDelivery ? branchPoint : effectiveUserCoords,
      to: isDelivery ? effectiveUserCoords : branchPoint,
      label: isDelivery
        ? `Branch ➔ You (${activeBranch.distanceKm} km)`
        : `You ➔ Branch (${activeBranch.distanceKm} km)`,
      color: isDelivery ? '#EA580C' : '#2563EB',
    };
  }, [activeBranch, effectiveUserCoords, isDelivery]);

  return (
    <div
      className="foodies-modal-overlay"
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
        className="foodies-modal-card"
        style={{
          position: 'relative',
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          width: 'clamp(340px, 95vw, 840px)',
          height: 'clamp(500px, 82vh, 620px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* ============ COMPACT MODAL TOP HEADER ============ */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card-subtle)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
            Store Locator
          </h3>

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
                      opacity: 1,
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {b.isOpen ? (
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
                            ● Open
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 900,
                              padding: '1px 5px',
                              borderRadius: '8px',
                              backgroundColor: '#FEE2E2',
                              color: '#DC2626',
                            }}
                          >
                            ● Closed / Offline
                          </span>
                        )}
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
                        {isSelected && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 900,
                              padding: '1px 5px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                            }}
                          >
                            ✓ Selected
                          </span>
                        )}
                      </div>
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
                      onClick={(e) => {
                        if (isManagerOrOwner) {
                          e.stopPropagation();
                          handleStartEdit(b, e);
                        }
                      }}
                      title={isManagerOrOwner ? 'Click to edit branch location & GPS' : undefined}
                      style={{
                        fontSize: '11px',
                        fontWeight: 450,
                        color: 'var(--text-muted)',
                        lineHeight: 1.35,
                        cursor: isManagerOrOwner ? 'pointer' : 'inherit',
                      }}
                    >
                      {b.address} {isManagerOrOwner && <span style={{ color: '#7C3AED', fontWeight: 700 }}>· Edit 📍</span>}
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
            RIGHT 3 QUARTERS (~72% width): INTERACTIVE OPENSTREETMAP VIEW
            Showing current location, branch locations, search, GPS & directional route
            ========================================================================
          */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#F8FAFC',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: '10px',
              gap: '8px',
            }}
          >
            {/* Location Selector Toolbar: If saved addresses exist, show "Use already saved location", otherwise Quick City Preset */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              {savedAddresses && savedAddresses.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    Use Already Saved Location:
                  </span>
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        setMapZoom(14);
                        if (addr.coordinates) {
                          handleUpdateLocation(addr.coordinates, true, addr.address);
                        } else {
                          setSelectedDeliveryAddress(addr.address);
                        }
                      }}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '999px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        color: 'var(--primary)',
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      📍 {addr.label}: {addr.address.length > 20 ? `${addr.address.substring(0, 20)}...` : addr.address}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflowX: 'auto' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    Quick Area Preset:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMapZoom(13);
                      handleUpdateLocation({ lat: 31.5204, lng: 74.3587 }, true, 'Main Boulevard Gulberg III, Lahore');
                    }}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '10px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📍 Lahore
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMapZoom(13);
                      handleUpdateLocation({ lat: 33.6844, lng: 73.0479 }, true, 'Sector F-7 / Blue Area, Islamabad');
                    }}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '10px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📍 Islamabad
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMapZoom(13);
                      handleUpdateLocation({ lat: 24.8607, lng: 67.0011 }, true, 'Clifton / DHA, Karachi');
                    }}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '10px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📍 Karachi
                  </button>
                </div>
              )}
              <span style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                Click map to store current location pin
              </span>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <OpenStreetMapView
                center={osmMapCenter}
                zoom={mapZoom}
                height={275}
                markers={osmMarkers}
                selectedMarkerId={selectedBranchId}
                onSelectMarker={(id) => {
                  if (id !== 'customer-current-loc') {
                    handleSelectBranch(id);
                  }
                }}
                interactivePin={effectiveUserCoords}
                onPinChange={(coords, geo) => {
                  handleUpdateLocation(coords, true, geo?.address);
                }}
                onGpsLocated={(coords, geo) => {
                  setMapZoom(14);
                  handleUpdateLocation(coords, true, geo?.address || '');
                }}
                routeLine={osmRouteLine}
                showSearch={true}
                showGpsButton={true}
                modeLabel={isDelivery ? 'OpenStreetMap • Delivery & Branch View' : 'OpenStreetMap • Branch Locator'}
                externalDirectionsOrigin={effectiveUserCoords}
              />
            </div>

            {/* Compact Floating Branch Details Card at bottom of map */}
            {activeBranch && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexShrink: 0,
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
                    href={getOsmDirectionsUrl(effectiveUserCoords, {
                      lat: activeBranch.resolvedLat,
                      lng: activeBranch.resolvedLng,
                    })}
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
                    <span>OpenStreetMap Directions</span>
                  </a>

                  {onProceedToPayment ? (
                    <button
                      type="button"
                      disabled={!activeBranch.isOpen}
                      onClick={() => {
                        if (!activeBranch.isOpen) return;
                        handleSelectBranch(activeBranch.id);
                        onProceedToPayment();
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: activeBranch.isOpen ? 'var(--primary)' : '#9CA3AF',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '11.5px',
                        fontWeight: 850,
                        cursor: activeBranch.isOpen ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: activeBranch.isOpen ? 1 : 0.7,
                      }}
                    >
                      <span>{activeBranch.isOpen ? 'Proceed to Payment' : 'Branch Closed / Offline'}</span>
                      <ArrowRight size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!activeBranch.isOpen}
                      onClick={() => {
                        if (!activeBranch.isOpen) return;
                        handleSelectBranch(activeBranch.id);
                        onClose();
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: activeBranch.isOpen ? 'var(--primary)' : '#E5E7EB',
                        color: activeBranch.isOpen ? '#000000' : '#9CA3AF',
                        border: 'none',
                        fontSize: '11.5px',
                        fontWeight: 850,
                        cursor: activeBranch.isOpen ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: activeBranch.isOpen ? 1 : 0.7,
                      }}
                    >
                      <Check size={13} />
                      <span>
                        {!activeBranch.isOpen
                          ? 'Closed / Offline'
                          : currentBranchId === activeBranch.id
                          ? 'Selected'
                          : 'Select Branch'}
                      </span>
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
                      Edit Location
                    </h4>
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

                {/* Interactive OpenStreetMap Branch Coordinate Picker */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Pick Branch Location on OpenStreetMap
                  </label>
                  <OpenStreetMapView
                    center={{ lat: editForm.latitude || 31.5126, lng: editForm.longitude || 74.3436 }}
                    zoom={14}
                    height={190}
                    interactivePin={{ lat: editForm.latitude || 31.5126, lng: editForm.longitude || 74.3436 }}
                    onPinChange={(coords, geo) => {
                      setEditForm((f) => ({
                        ...f,
                        latitude: coords.lat,
                        longitude: coords.lng,
                        address: geo?.address || f.address,
                        city: geo?.city || f.city,
                      }));
                    }}
                    onGpsLocated={(coords, geo) => {
                      setEditForm((f) => ({
                        ...f,
                        latitude: coords.lat,
                        longitude: coords.lng,
                        address: geo?.address || f.address,
                        city: geo?.city || f.city,
                      }));
                    }}
                    showSearch={true}
                    showGpsButton={true}
                    modeLabel="Click OpenStreetMap to Set Branch Pin"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                    Max Order Distance (km)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    required
                    value={editForm.maxOrderDistanceKm}
                    onChange={(e) => setEditForm((f) => ({ ...f, maxOrderDistanceKm: parseFloat(e.target.value) || 50 }))}
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
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    Customers beyond this distance cannot place orders or select this branch.
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                    Table QR Max Ordering Distance (Meters)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    step="10"
                    required
                    value={editForm.tableQrMaxDistanceMeters}
                    onChange={(e) => setEditForm((f) => ({ ...f, tableQrMaxDistanceMeters: parseInt(e.target.value) || 300 }))}
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
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    Allowed radius for on-table physical QR orders (default 300m). Beyond this, table ordering is blocked.
                  </span>
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
