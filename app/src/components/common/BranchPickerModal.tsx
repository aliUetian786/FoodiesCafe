'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Navigation, X, Clock, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Branch } from '@/types/cafe';
import { normalizeBranchId } from '@/types/cafe';
import {
  FRANCHISE_NAME,
  branchCoords,
  branchStatus,
  distanceKm,
  formatDistance,
  googleMapsDirectionsUrl,
} from '@/lib/branchInfo';

interface BranchPickerModalProps {
  isOpen: boolean;
  orderType: 'takeaway' | 'dine_in';
  onClose: () => void;
  /** Called after the branch has been selected (setCurrentBranchId already applied). */
  onSelected: (branch: Branch) => void;
}

/**
 * "Choose a branch" list shown after picking Takeaway or Dine-In (like big QSR apps):
 * nearest open branches first, live open/closed status, distance from the customer's GPS position,
 * and Google Maps directions. Closed branches are listed but cannot be selected.
 */
export function BranchPickerModal({ isOpen, orderType, onClose, onSelected }: BranchPickerModalProps) {
  const { branches, currentBranchId, setCurrentBranchId, customerCoordinates, setCustomerCoordinates } = useApp();
  const [locating, setLocating] = useState(false);
  const askedRef = useRef(false);

  // Ask for GPS once (only if we don't know the customer's position yet) to sort by distance.
  useEffect(() => {
    if (!isOpen || customerCoordinates || askedRef.current) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    askedRef.current = true;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerCoordinates({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [isOpen, customerCoordinates, setCustomerCoordinates]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const rows = useMemo(() => {
    return branches
      .map((b) => {
        const c = branchCoords(b);
        const km = customerCoordinates && c ? distanceKm(customerCoordinates, c) : null;
        return { branch: b, km, status: branchStatus(b), coords: c };
      })
      .sort((a, b) => {
        if (a.status.open !== b.status.open) return a.status.open ? -1 : 1;
        if (a.km !== null && b.km !== null) return a.km - b.km;
        return a.branch.name.localeCompare(b.branch.name);
      });
  }, [branches, customerCoordinates]);

  if (!isOpen) return null;

  const title = orderType === 'dine_in' ? 'Where would you like to dine?' : 'Pick up from which branch?';

  return (
    <div
      className="foodies-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        backgroundColor: 'rgba(15, 12, 10, 0.6)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: 'min(86vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>{title}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: locating ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
              {locating
                ? '📍 Finding branches near you…'
                : customerCoordinates
                  ? 'Nearest open branches first'
                  : 'Turn on location to see the nearest branch'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rows.map(({ branch, km, status, coords }, idx) => {
            const isCurrent = normalizeBranchId(branch.id) === normalizeBranchId(currentBranchId);
            const nearestOpen = idx === 0 && status.open && km !== null;
            return (
              <div
                key={branch.id}
                style={{
                  border: `1.5px solid ${isCurrent && status.open ? 'var(--primary)' : 'var(--border-color)'}`,
                  borderRadius: '14px',
                  padding: '12px 14px',
                  backgroundColor: status.open ? 'var(--bg-card)' : 'var(--bg-card-subtle)',
                  opacity: status.open ? 1 : 0.78,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: status.open ? 'var(--primary-light)' : 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={18} color={status.open ? 'var(--primary)' : 'var(--text-muted)'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14.5px', fontWeight: 850, color: 'var(--text-main)' }}>{branch.name}</span>
                      {nearestOpen && (
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '999px', backgroundColor: '#DCFCE7', color: '#15803D' }}>NEAREST</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>{FRANCHISE_NAME} · {branch.city}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.35 }}>{branch.address}</div>
                  </div>
                  {km !== null && (
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatDistance(km)}</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: status.open ? '#15803D' : '#B91C1C' }}>
                  <Clock size={13} />
                  <span>{status.label}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {coords && (
                    <a
                      href={googleMapsDirectionsUrl(coords, customerCoordinates)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 12px', minHeight: '40px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 750, textDecoration: 'none' }}
                    >
                      <Navigation size={14} />
                      Directions
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={!status.open}
                    onClick={() => {
                      setCurrentBranchId(branch.id, true);
                      onSelected(branch);
                    }}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '9px 12px',
                      minHeight: '40px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: status.open ? 'var(--primary)' : 'var(--border-color)',
                      color: status.open ? '#FFFFFF' : 'var(--text-muted)',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: status.open ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {status.open ? (
                      <>
                        <CheckCircle2 size={15} />
                        {orderType === 'dine_in' ? 'Dine here' : 'Pick up here'}
                      </>
                    ) : (
                      'Closed — cannot order'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
