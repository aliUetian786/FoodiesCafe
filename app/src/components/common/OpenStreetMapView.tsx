'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  ExternalLink,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Search,
  Store,
  X,
} from 'lucide-react';
import {
  OSM_TILE_SIZE,
  OsmCoordinates,
  OsmMarkerItem,
  OsmSearchResult,
  getOsmDirectionsUrl,
  getOsmFallbackTileUrl,
  getOsmPlaceUrl,
  getOsmTileUrl,
  latLngToWorldPixel,
  reverseGeocodeOpenStreetMap,
  searchOpenStreetMap,
  worldPixelToLatLng,
} from '../../utils/openStreetMap';

export interface OpenStreetMapViewProps {
  center: OsmCoordinates;
  zoom?: number;
  height?: number | string;
  markers?: OsmMarkerItem[];
  selectedMarkerId?: string;
  onSelectMarker?: (id: string) => void;
  interactivePin?: OsmCoordinates | null;
  onPinChange?: (
    coords: OsmCoordinates,
    reverseGeocoded?: { address: string; city: string }
  ) => void;
  routeLine?: {
    from: OsmCoordinates;
    to: OsmCoordinates;
    label?: string;
    color?: string;
  } | null;
  multiStopPoints?: { lat: number; lng: number; label: string }[];
  showSearch?: boolean;
  showGpsButton?: boolean;
  onGpsLocated?: (
    coords: OsmCoordinates,
    addressInfo: { address: string; city: string }
  ) => void;
  modeLabel?: string;
  externalDirectionsOrigin?: OsmCoordinates | null;
}

export const OpenStreetMapView: React.FC<OpenStreetMapViewProps> = ({
  center,
  zoom: initialZoom = 14,
  height = 380,
  markers = [],
  selectedMarkerId,
  onSelectMarker,
  interactivePin,
  onPinChange,
  routeLine,
  multiStopPoints,
  showSearch = true,
  showGpsButton = true,
  onGpsLocated,
  modeLabel = 'OpenStreetMap • Live Street View',
  externalDirectionsOrigin,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 640,
    height: typeof height === 'number' ? height : 380,
  });
  const [viewCenter, setViewCenter] = useState<OsmCoordinates>(center);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OsmSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

  const dragRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    moved: boolean;
    startWorldX: number;
    startWorldY: number;
  }>({
    isDown: false,
    startX: 0,
    startY: 0,
    moved: false,
    startWorldX: 0,
    startWorldY: 0,
  });

  // Sync map view center when parent changes center explicitly
  useEffect(() => {
    if (
      center &&
      typeof center.lat === 'number' &&
      typeof center.lng === 'number' &&
      !Number.isNaN(center.lat) &&
      !Number.isNaN(center.lng)
    ) {
      setViewCenter(center);
    }
  }, [center.lat, center.lng]);

  useEffect(() => {
    setZoom(initialZoom);
  }, [initialZoom]);

  // Measure actual pixel dimensions for crisp Web Mercator math
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateSize());
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const centerWorld = useMemo(
    () => latLngToWorldPixel(viewCenter.lat, viewCenter.lng, zoom),
    [viewCenter.lat, viewCenter.lng, zoom]
  );

  const projectToScreen = (lat: number, lng: number) => {
    const world = latLngToWorldPixel(lat, lng, zoom);
    return {
      x: size.width / 2 + (world.x - centerWorld.x),
      y: size.height / 2 + (world.y - centerWorld.y),
    };
  };

  // Compute visible 256px OpenStreetMap tiles
  const visibleTiles = useMemo(() => {
    const topLeftWorldX = centerWorld.x - size.width / 2;
    const topLeftWorldY = centerWorld.y - size.height / 2;
    const minTileX = Math.floor(topLeftWorldX / OSM_TILE_SIZE) - 1;
    const maxTileX = Math.floor((topLeftWorldX + size.width) / OSM_TILE_SIZE) + 1;
    const minTileY = Math.floor(topLeftWorldY / OSM_TILE_SIZE) - 1;
    const maxTileY = Math.floor((topLeftWorldY + size.height) / OSM_TILE_SIZE) + 1;

    const tiles: {
      key: string;
      url: string;
      left: number;
      top: number;
      tx: number;
      ty: number;
      z: number;
    }[] = [];

    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const url = getOsmTileUrl(tx, ty, zoom);
        if (!url) continue;
        tiles.push({
          key: `${zoom}-${tx}-${ty}`,
          url,
          left: tx * OSM_TILE_SIZE - topLeftWorldX,
          top: ty * OSM_TILE_SIZE - topLeftWorldY,
          tx,
          ty,
          z: zoom,
        });
      }
    }
    return tiles;
  }, [centerWorld.x, centerWorld.y, size.width, size.height, zoom]);

  const commitPinAtCoords = async (coords: OsmCoordinates) => {
    if (!onPinChange) return;
    // Immediately place pin at exact coordinates, then refine with OpenStreetMap reverse geocoding
    onPinChange(coords);
    setIsReverseGeocoding(true);
    try {
      const geo = await reverseGeocodeOpenStreetMap(coords.lat, coords.lng);
      onPinChange(coords, { address: geo.address, city: geo.city });
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement)?.closest('[data-osm-control="true"]')) {
      return;
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    dragRef.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      startWorldX: centerWorld.x,
      startWorldY: centerWorld.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDown) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    if (dragRef.current.moved) {
      const nextCenter = worldPixelToLatLng(
        dragRef.current.startWorldX - dx,
        dragRef.current.startWorldY - dy,
        zoom
      );
      setViewCenter(nextCenter);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDown) return;
    dragRef.current.isDown = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (!dragRef.current.moved && onPinChange && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const worldX = centerWorld.x - size.width / 2 + clickX;
      const worldY = centerWorld.y - size.height / 2 + clickY;
      const clickedCoords = worldPixelToLatLng(worldX, worldY, zoom);
      commitPinAtCoords(clickedCoords);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchOpenStreetMap(searchQuery);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePickSearchResult = (item: OsmSearchResult) => {
    const coords = { lat: item.lat, lng: item.lng };
    setViewCenter(coords);
    setZoom((z) => Math.max(z, 15));
    setSearchResults([]);
    setSearchQuery(item.shortAddress);
    if (onPinChange) {
      onPinChange(coords, { address: item.shortAddress, city: item.city });
    }
  };

  const handleDetectGps = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setViewCenter(coords);
        setZoom((z) => Math.max(z, 15));
        const geo = await reverseGeocodeOpenStreetMap(coords.lat, coords.lng);
        setIsLocating(false);
        if (onPinChange) {
          onPinChange(coords, { address: geo.address, city: geo.city });
        }
        if (onGpsLocated) {
          onGpsLocated(coords, { address: geo.address, city: geo.city });
        }
      },
      async () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const activePinPos = interactivePin
    ? projectToScreen(interactivePin.lat, interactivePin.lng)
    : null;

  const routeFromScreen = routeLine
    ? projectToScreen(routeLine.from.lat, routeLine.from.lng)
    : null;
  const routeToScreen = routeLine
    ? projectToScreen(routeLine.to.lat, routeLine.to.lng)
    : null;

  const multiStopScreenPoints = useMemo(() => {
    if (!multiStopPoints || multiStopPoints.length === 0) return [];
    return multiStopPoints.map((pt) => ({
      ...pt,
      ...projectToScreen(pt.lat, pt.lng),
    }));
  }, [multiStopPoints, centerWorld.x, centerWorld.y, zoom, size.width, size.height]);

  const activeExternalCoords = interactivePin || (routeLine ? routeLine.to : viewCenter);
  const externalOsmUrl = externalDirectionsOrigin
    ? getOsmDirectionsUrl(externalDirectionsOrigin, activeExternalCoords, zoom)
    : getOsmPlaceUrl(activeExternalCoords.lat, activeExternalCoords.lng, zoom);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '100%',
      }}
    >
      {/* Search + GPS Bar */}
      {(showSearch || showGpsButton) && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
            position: 'relative',
            zIndex: 25,
          }}
        >
          {showSearch && (
            <form
              onSubmit={handleSearchSubmit}
              style={{
                flex: '1 1 240px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={15}
                  color="#94A3B8"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search street, area, landmark on OpenStreetMap..."
                  style={{
                    width: '100%',
                    padding: '9px 32px 9px 34px',
                    borderRadius: '10px',
                    border: '1.5px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                    }}
                  >
                    <X size={14} color="#64748B" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isSearching}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: '1px solid #EA580C',
                  backgroundColor: '#EA580C',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSearching ? 'Searching...' : 'Find'}
              </button>

              {searchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '44px',
                    left: 0,
                    right: 0,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.14)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 40,
                  }}
                >
                  {searchResults.map((res) => (
                    <button
                      key={res.placeId}
                      type="button"
                      onClick={() => handlePickSearchResult(res)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <MapPin size={15} color="#EA580C" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.83rem',
                            fontWeight: 700,
                            color: '#0F172A',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {res.shortAddress}
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: '#64748B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {res.displayName}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>
          )}

          {showGpsButton && (
            <button
              type="button"
              onClick={handleDetectGps}
              disabled={isLocating}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1.5px solid #BFDBFE',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <LocateFixed size={15} />
              {isLocating ? 'Detecting GPS...' : 'My Current Location (GPS)'}
            </button>
          )}
        </div>
      )}

      {/* Map Viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'relative',
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1.5px solid #CBD5E1',
          backgroundColor: '#EEF2F6',
          backgroundImage:
            'linear-gradient(to right, rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.16) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          cursor: onPinChange ? 'crosshair' : 'grab',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* Real OpenStreetMap Raster Tiles */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          {visibleTiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              draggable={false}
              onError={(e) => {
                const fallback = getOsmFallbackTileUrl(tile.tx, tile.ty, tile.z);
                if (fallback && e.currentTarget.src !== fallback) {
                  e.currentTarget.src = fallback;
                }
              }}
              style={{
                position: 'absolute',
                left: `${tile.left}px`,
                top: `${tile.top}px`,
                width: `${OSM_TILE_SIZE}px`,
                height: `${OSM_TILE_SIZE}px`,
                maxWidth: 'none',
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>

        {/* SVG Route Polyline Overlay */}
        {(routeFromScreen && routeToScreen) || multiStopScreenPoints.length > 1 ? (
          <svg
            width={size.width}
            height={size.height}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 6,
            }}
          >
            {routeFromScreen && routeToScreen && (
              <>
                <line
                  x1={routeFromScreen.x}
                  y1={routeFromScreen.y}
                  x2={routeToScreen.x}
                  y2={routeToScreen.y}
                  stroke={routeLine?.color || '#EA580C'}
                  strokeWidth={4}
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                />
                <circle
                  cx={routeFromScreen.x}
                  cy={routeFromScreen.y}
                  r={6}
                  fill="#FFFFFF"
                  stroke={routeLine?.color || '#EA580C'}
                  strokeWidth={3}
                />
                <circle
                  cx={routeToScreen.x}
                  cy={routeToScreen.y}
                  r={6}
                  fill={routeLine?.color || '#EA580C'}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              </>
            )}

            {multiStopScreenPoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#0F766E"
                strokeWidth={4}
                strokeDasharray="8 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={multiStopScreenPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            )}
          </svg>
        ) : null}

        {/* Route Midpoint Badge */}
        {routeFromScreen && routeToScreen && routeLine?.label && (
          <div
            style={{
              position: 'absolute',
              left: `${(routeFromScreen.x + routeToScreen.x) / 2}px`,
              top: `${(routeFromScreen.y + routeToScreen.y) / 2}px`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255,255,255,0.96)',
              border: '1.5px solid #FED7AA',
              borderRadius: '999px',
              padding: '3px 10px',
              fontSize: '0.73rem',
              fontWeight: 800,
              color: '#C2410C',
              boxShadow: '0 4px 12px rgba(15,23,42,0.14)',
              pointerEvents: 'none',
              zIndex: 8,
              whiteSpace: 'nowrap',
            }}
          >
            {routeLine.label}
          </div>
        )}

        {/* Map Markers (Branches, Customer, Rider Stops) */}
        {markers.map((marker) => {
          const pos = projectToScreen(marker.lat, marker.lng);
          const isSelected = marker.id === selectedMarkerId || marker.kind === 'selected_branch';
          const isHovered = marker.id === hoveredMarkerId;
          const isCustomer = marker.kind === 'customer';
          const isRiderStop = marker.kind === 'rider_stop';

          return (
            <button
              key={marker.id}
              type="button"
              data-osm-control="true"
              onClick={() => {
                setViewCenter({ lat: marker.lat, lng: marker.lng });
                onSelectMarker?.(marker.id);
              }}
              onMouseEnter={() => setHoveredMarkerId(marker.id)}
              onMouseLeave={() => setHoveredMarkerId(null)}
              style={{
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                transform: 'translate(-50%, -100%)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                zIndex: isSelected ? 14 : isCustomer ? 12 : 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {(isSelected || isHovered || isCustomer || isRiderStop) && (
                <div
                  style={{
                    marginBottom: '4px',
                    backgroundColor: '#FFFFFF',
                    border: `1.5px solid ${
                      isCustomer ? '#2563EB' : isSelected ? '#EA580C' : '#CBD5E1'
                    }`,
                    borderRadius: '8px',
                    padding: '3px 8px',
                    boxShadow: '0 4px 12px rgba(15,23,42,0.16)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: '#0F172A',
                    }}
                  >
                    {marker.title}
                  </span>
                  {marker.badgeText && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: isCustomer ? '#1D4ED8' : '#EA580C',
                        backgroundColor: isCustomer ? '#EFF6FF' : '#FFF7ED',
                        padding: '1px 5px',
                        borderRadius: '5px',
                      }}
                    >
                      {marker.badgeText}
                    </span>
                  )}
                </div>
              )}

              <div
                style={{
                  width: isSelected ? '38px' : '32px',
                  height: isSelected ? '38px' : '32px',
                  borderRadius: '999px',
                  backgroundColor: isCustomer
                    ? '#2563EB'
                    : isRiderStop
                    ? '#0F766E'
                    : isSelected
                    ? '#EA580C'
                    : '#FFFFFF',
                  border: `2.5px solid ${
                    isCustomer || isSelected || isRiderStop ? '#FFFFFF' : '#EA580C'
                  }`,
                  boxShadow: '0 6px 16px rgba(15,23,42,0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color:
                    isCustomer || isSelected || isRiderStop ? '#FFFFFF' : '#EA580C',
                }}
              >
                {isCustomer ? (
                  <Navigation size={15} />
                ) : (
                  <Store size={isSelected ? 17 : 15} />
                )}
              </div>
            </button>
          );
        })}

        {/* Interactive Delivery / Branch Pin */}
        {activePinPos && (
          <div
            style={{
              position: 'absolute',
              left: `${activePinPos.x}px`,
              top: `${activePinPos.y}px`,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '999px',
                marginBottom: '4px',
                boxShadow: '0 4px 10px rgba(15,23,42,0.25)',
                whiteSpace: 'nowrap',
              }}
            >
              {isReverseGeocoding ? 'Resolving address...' : 'Pinned Location'}
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '999px',
                backgroundColor: '#EA580C',
                border: '3px solid #FFFFFF',
                boxShadow: '0 8px 18px rgba(234,88,12,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <MapPin size={19} />
            </div>
          </div>
        )}

        {/* Top-Left Mode Pill */}
        <div
          data-osm-control="true"
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            backgroundColor: 'rgba(255,255,255,0.94)',
            border: '1px solid #E2E8F0',
            borderRadius: '999px',
            padding: '5px 12px',
            fontSize: '0.74rem',
            fontWeight: 800,
            color: '#0F172A',
            boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 20,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '999px',
              backgroundColor: '#16A34A',
              display: 'inline-block',
            }}
          />
          {modeLabel}
        </div>

        {/* Top-Right Zoom & Recenter Controls */}
        <div
          data-osm-control="true"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 20,
          }}
        >
          <button
            type="button"
            title="Zoom In"
            onClick={() => setZoom((z) => Math.min(18, z + 1))}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15,23,42,0.1)',
            }}
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            title="Zoom Out"
            onClick={() => setZoom((z) => Math.max(5, z - 1))}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15,23,42,0.1)',
            }}
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            title="Re-center Map"
            onClick={() => setViewCenter(interactivePin || center)}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#EA580C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15,23,42,0.1)',
            }}
          >
            <Crosshair size={16} />
          </button>
        </div>

        {/* Bottom-Left Coordinates Readout */}
        <div
          data-osm-control="true"
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '12px',
            backgroundColor: 'rgba(255,255,255,0.92)',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '4px 9px',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#475569',
            zIndex: 20,
          }}
        >
          {(interactivePin || viewCenter).lat.toFixed(5)},{' '}
          {(interactivePin || viewCenter).lng.toFixed(5)} • z{zoom}
        </div>

        {/* Bottom-Right OpenStreetMap Attribution & External Link */}
        <a
          data-osm-control="true"
          href={externalOsmUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '12px',
            backgroundColor: 'rgba(255,255,255,0.94)',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#0F172A',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            zIndex: 20,
            boxShadow: '0 2px 6px rgba(15,23,42,0.08)',
          }}
        >
          © OpenStreetMap
          <ExternalLink size={12} color="#EA580C" />
        </a>
      </div>
    </div>
  );
};
