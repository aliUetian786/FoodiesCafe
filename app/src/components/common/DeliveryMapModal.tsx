'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Branch } from '@/types/cafe';
import {
  MapPin,
  Check,
  X,
  Navigation,
  Building,
  Home,
  Briefcase,
  Trash2,
  Compass,
  ArrowRight,
  Bike,
} from 'lucide-react';
import { OpenStreetMapView } from './OpenStreetMapView';
import { reverseGeocodeOpenStreetMap } from '@/utils/openStreetMap';

interface DeliveryMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelivery: (address: string, branch: Branch) => void;
}

// Preset locations in Lahore with realistic coordinates (fallback when no saved locations)
const PRESET_ZONES = [
  {
    name: 'Gulberg III',
    area: 'Main Boulevard, Gulberg III',
    coords: { lat: 31.5204, lng: 74.3587 },
  },
  {
    name: 'DHA Phase 5',
    area: 'Sector C, DHA Phase 5',
    coords: { lat: 31.4704, lng: 74.4103 },
  },
  {
    name: 'Johar Town',
    area: 'G1 Market, Johar Town',
    coords: { lat: 31.4697, lng: 74.2982 },
  },
  {
    name: 'Model Town',
    area: 'Bank Square, Model Town',
    coords: { lat: 31.4875, lng: 74.3195 },
  },
  {
    name: 'Mall Road',
    area: 'Shahrah-e-Quaid-e-Azam, Mall Road',
    coords: { lat: 31.5656, lng: 74.3142 },
  },
];

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

export const DeliveryMapModal: React.FC<DeliveryMapModalProps> = ({
  isOpen,
  onClose,
  onConfirmDelivery,
}) => {
  const {
    branches,
    savedAddresses,
    addSavedAddress,
    setCustomerCoordinates,
    setSelectedDeliveryAddress,
    setCurrentBranchId,
    addToast,
  } = useApp();

  const [selectedSavedId, setSelectedSavedId] = useState<string>(
    savedAddresses[0]?.id || ''
  );

  // The map opens on the customer's LIVE position (fetched each time it opens), never on a saved one.
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number }>({ lat: 31.5204, lng: 74.3587 });
  const [pinCity, setPinCity] = useState<string>('Lahore');
  const [pinConfirmed, setPinConfirmed] = useState(false);

  const [writtenAddress, setWrittenAddress] = useState<string>('');
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [saveToProfile, setSaveToProfile] = useState<boolean>(true);

  // 1) ask for location permission (the browser prompt), 2) take a fresh GPS fix (maximumAge 0, so no
  // cached position), 3) pin it and fill the written address from OpenStreetMap.
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const liveRunRef = React.useRef(0);
  const locateLive = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationDenied(true);
      return;
    }
    const runId = ++liveRunRef.current;
    setLocating(true);
    setLocationDenied(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (runId !== liveRunRef.current) return;
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setPinCoords(coords);
        if (setCustomerCoordinates) setCustomerCoordinates(coords);
        setLocating(false);
        try {
          const geo = await reverseGeocodeOpenStreetMap(coords.lat, coords.lng);
          if (runId !== liveRunRef.current) return;
          if (geo?.address) setWrittenAddress(geo.address);
          if (geo?.city) setPinCity(geo.city);
        } catch { }
      },
      (err) => {
        if (runId !== liveRunRef.current) return;
        setLocating(false);
        setLocationDenied(true);
        addToast({
          type: 'info',
          title: err?.code === 1 ? 'Location permission denied' : 'Live location unavailable',
          message: 'Drag the pin, search, or pick an area to set your delivery location.',
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [setCustomerCoordinates, addToast]);

  // Every time the modal opens: reset, then ask permission and jump to the live location.
  useEffect(() => {
    if (!isOpen) {
      liveRunRef.current += 1; // cancel a lookup still running
      return;
    }
    setPinConfirmed(false);
    setWrittenAddress('');
    if (savedAddresses.length > 0) {
      setSelectedSavedId(savedAddresses[0].id);
    }
    locateLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Nearest branch that can actually take a delivery right now (open + delivery enabled);
  // falls back to all branches only if none qualifies, so the customer still sees a result.
  const findNearestBranch = (coords: { lat: number; lng: number }): { branch: Branch; dist: number } => {
    const eligible = branches.filter((b) => b.isOpen && b.deliveryEnabled !== false);
    const pool = eligible.length > 0 ? eligible : branches;
    let nearest = pool[0];
    let minD = 999999;
    pool.forEach((b) => {
      const bLat = Number(b.latitude) || 31.5126;
      const bLng = Number(b.longitude) || 74.3436;
      const d = calculateDistanceKm(coords.lat, coords.lng, bLat, bLng);
      if (d < minD) {
        minD = d;
        nearest = b;
      }
    });
    return { branch: nearest, dist: minD };
  };

  const currentNearest = findNearestBranch(pinCoords);

  const handleSelectZone = (zone: (typeof PRESET_ZONES)[0]) => {
    setPinCoords(zone.coords);
    setWrittenAddress(`House #, ${zone.area}, Lahore`);
    addToast({
      type: 'info',
      title: 'Preset Area Selected',
      message: `Pin centered at ${zone.name}`,
    });
  };

  const handleConfirmPinLocation = () => {
    setPinConfirmed(true);
    addToast({
      type: 'success',
      title: 'Pin Location Confirmed',
      message: 'Review written address details below.',
    });
  };

  const handleFinalizeNewAddress = () => {
    if (!writtenAddress.trim()) {
      addToast({
        type: 'warning',
        title: 'Address Required',
        message: 'Please enter your written delivery address lines.',
      });
      return;
    }

    const cleanAddr = writtenAddress.trim();
    if (setCustomerCoordinates) setCustomerCoordinates(pinCoords);
    if (setSelectedDeliveryAddress) setSelectedDeliveryAddress(cleanAddr);

    if (saveToProfile && addSavedAddress) {
      addSavedAddress({
        label: addressLabel,
        address: cleanAddr,
        city: pinCity || 'Lahore',
        coordinates: pinCoords,
        isDefault: false,
      });
    }

    if (setCurrentBranchId) {
      setCurrentBranchId(currentNearest.branch.id);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('foodies_customer_coordinates', JSON.stringify(pinCoords));
      localStorage.setItem('foodies_customer_address', cleanAddr);
      localStorage.setItem('foodies_customer_branch', currentNearest.branch.id);
    }

    onConfirmDelivery(cleanAddr, currentNearest.branch);
  };

  if (!isOpen) return null;

  return (
    <div
      className="foodies-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(5px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="foodies-modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 24px 56px rgba(0, 0, 0, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          animation: 'fadeInUp 0.2s ease-out',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(217, 101, 40, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Bike size={20} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 900,
                  color: 'var(--text-main)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Confirm Delivery Location
              </h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: locating ? 'var(--primary)' : 'var(--text-muted)', fontWeight: locating ? 700 : 400 }}>
                {locating ? '📍 Finding your live location…' : 'Drag pin or search • Fulfilled by nearest open branch'}
              </p>
              {locationDenied && !locating && (
                <button
                  type="button"
                  onClick={locateLive}
                  style={{
                    marginTop: '4px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    border: '1px solid var(--primary)',
                    backgroundColor: 'transparent',
                    color: 'var(--primary)',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  📍 Use my live location
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Live OpenStreetMap Canvas */}
          <div
            style={{
              borderRadius: '14px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <OpenStreetMapView
              center={pinCoords}
              zoom={14}
              height={260}
              interactivePin={pinCoords}
              onPinChange={(coords, geo) => {
                setPinCoords(coords);
                if (geo?.address) setWrittenAddress(geo.address);
                if (geo?.city) setPinCity(geo.city);
              }}
              onGpsLocated={(coords, geo) => {
                setPinCoords(coords);
                if (geo?.address) setWrittenAddress(geo.address);
                if (geo?.city) setPinCity(geo.city);
                if (setCustomerCoordinates) setCustomerCoordinates(coords);
                if (setSelectedDeliveryAddress && geo?.address) {
                  setSelectedDeliveryAddress(geo.address);
                }
                addToast({
                  type: 'success',
                  title: 'GPS Location Detected',
                  message: geo?.address || 'Current position pinned on map',
                });
              }}
              markers={[
                {
                  id: 'nearest-branch-marker',
                  lat: Number(currentNearest.branch.latitude) || 31.5126,
                  lng: Number(currentNearest.branch.longitude) || 74.3436,
                  title: currentNearest.branch.name,
                  kind: 'selected_branch',
                },
              ]}
              routeLine={{
                from: {
                  lat: Number(currentNearest.branch.latitude) || 31.5126,
                  lng: Number(currentNearest.branch.longitude) || 74.3436,
                },
                to: pinCoords,
                label: `${currentNearest.dist} km`,
              }}
              showSearch={true}
              showGpsButton={true}
              modeLabel="OpenStreetMap • Drag Pin to Confirm Delivery Address"
            />
          </div>

          {/* Location Selector: If savedAddresses exists, show "Use already saved location", otherwise "Tap Quick Area Preset" */}
          {savedAddresses.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📍</span> Use Already Saved Location:
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                }}
              >
                {savedAddresses.map((addr) => {
                  const isAddrActive =
                    (addr.coordinates &&
                      Math.abs(addr.coordinates.lat - pinCoords.lat) < 0.001 &&
                      Math.abs(addr.coordinates.lng - pinCoords.lng) < 0.001) ||
                    selectedSavedId === addr.id;

                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        setSelectedSavedId(addr.id);
                        if (addr.coordinates) {
                          setPinCoords(addr.coordinates);
                        }
                        setWrittenAddress(addr.address);
                        if (
                          addr.label === 'Home' ||
                          addr.label === 'Work' ||
                          addr.label === 'Other'
                        ) {
                          setAddressLabel(addr.label);
                        }
                        addToast({
                          type: 'info',
                          title: 'Saved Location Loaded',
                          message: `${addr.label}: ${addr.address}`,
                        });
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '999px',
                        border: isAddrActive
                          ? '1.5px solid var(--primary)'
                          : '1px solid var(--border-color)',
                        backgroundColor: isAddrActive
                          ? 'rgba(217, 101, 40, 0.1)'
                          : '#FFFFFF',
                        color: isAddrActive ? 'var(--primary)' : 'var(--text-main)',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                    >
                      {addr.label === 'Home' ? (
                        <Home size={13} />
                      ) : addr.label === 'Work' ? (
                        <Briefcase size={13} />
                      ) : (
                        <Building size={13} />
                      )}
                      <span>
                        {addr.label}: {addr.address.length > 25 ? `${addr.address.substring(0, 25)}...` : addr.address}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📍</span> Tap Quick Area Preset:
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                }}
              >
                {PRESET_ZONES.map((zone) => {
                  const isZoneActive =
                    Math.abs(zone.coords.lat - pinCoords.lat) < 0.005 &&
                    Math.abs(zone.coords.lng - pinCoords.lng) < 0.005;

                  return (
                    <button
                      key={zone.name}
                      type="button"
                      onClick={() => handleSelectZone(zone)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '999px',
                        border: isZoneActive
                          ? '1.5px solid var(--primary)'
                          : '1px solid var(--border-color)',
                        backgroundColor: isZoneActive
                          ? 'rgba(217, 101, 40, 0.1)'
                          : '#FFFFFF',
                        color: isZoneActive ? 'var(--primary)' : 'var(--text-secondary)',
                        fontSize: '11.5px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                    >
                      <MapPin size={12} />
                      <span>{zone.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirm Pin Location on Map Button if not confirmed yet */}
          {!pinConfirmed && (
            <button
              type="button"
              onClick={handleConfirmPinLocation}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: 850,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(217, 101, 40, 0.25)',
                transition: 'opacity 0.15s ease',
              }}
            >
              <Check size={16} />
              <span>Confirm Pin Location on Map</span>
            </button>
          )}

          {/* Written Address & Fulfillment Section (Always accessible once confirmed or auto-expanded) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 850, color: 'var(--text-main)' }}>
                Written Address Lines
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                Auto-fetched from OpenStreetMap • Editable
              </span>
            </div>

            <textarea
              rows={2}
              value={writtenAddress}
              onChange={(e) => setWrittenAddress(e.target.value)}
              placeholder="e.g. House #14, Street 5, Gulberg III, Lahore"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#FFFFFF',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                fontFamily: 'inherit',
                resize: 'none',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />

            {/* Address Label Selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-secondary)' }}>
                Address Label:
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setAddressLabel(lbl)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: addressLabel === lbl ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: addressLabel === lbl ? '#FFFFFF' : 'transparent',
                      color: addressLabel === lbl ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Address in Profile Checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                paddingTop: '4px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Save Address in Profile
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  Save to your account for 1-tap future delivery orders
                </div>
              </div>
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={(e) => setSaveToProfile(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
            </label>

            {/* Nearest Branch Card */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={15} color="var(--primary)" />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 850, color: 'var(--text-main)' }}>
                    Fulfilled by: {currentNearest.branch.name}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    Estimated distance: {currentNearest.dist} km
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: currentNearest.branch.isOpen ? '#16A34A' : '#DC2626',
                  backgroundColor: currentNearest.branch.isOpen ? '#DCFCE7' : '#FEE2E2',
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                {currentNearest.branch.isOpen ? '🟢 Open' : '🔴 Closed'}
              </span>
            </div>

            {/* Final Confirm & Deliver Button */}
            <button
              type="button"
              onClick={handleFinalizeNewAddress}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13.5px',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(217, 101, 40, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              <Check size={16} />
              <span>Confirm Delivery to This Address</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
