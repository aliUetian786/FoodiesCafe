import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import * as Location from 'expo-location';
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
} from 'lucide-react-native';
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
} from '../utils/openStreetMap';

export interface OpenStreetMapViewProps {
  center: OsmCoordinates;
  zoom?: number;
  height?: number;
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
  height = 280,
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
  modeLabel = 'OpenStreetMap',
  externalDirectionsOrigin,
}) => {
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 340,
    height,
  });
  const [viewCenter, setViewCenter] = useState<OsmCoordinates>(center);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OsmSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});

  const centerWorldRef = useRef(latLngToWorldPixel(center.lat, center.lng, initialZoom));
  const sizeRef = useRef(size);
  const zoomRef = useRef(zoom);
  const dragStartWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;

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

  const centerWorld = useMemo(
    () => latLngToWorldPixel(viewCenter.lat, viewCenter.lng, zoom),
    [viewCenter.lat, viewCenter.lng, zoom]
  );

  centerWorldRef.current = centerWorld;
  sizeRef.current = size;
  zoomRef.current = zoom;

  const projectToScreen = (lat: number, lng: number) => {
    const world = latLngToWorldPixel(lat, lng, zoom);
    return {
      x: size.width / 2 + (world.x - centerWorld.x),
      y: size.height / 2 + (world.y - centerWorld.y),
    };
  };

  const visibleTiles = useMemo(() => {
    const topLeftWorldX = centerWorld.x - size.width / 2;
    const topLeftWorldY = centerWorld.y - size.height / 2;
    const minTileX = Math.floor(topLeftWorldX / OSM_TILE_SIZE) - 1;
    const maxTileX = Math.floor((topLeftWorldX + size.width) / OSM_TILE_SIZE) + 1;
    const minTileY = Math.floor(topLeftWorldY / OSM_TILE_SIZE) - 1;
    const maxTileY = Math.floor((topLeftWorldY + size.height) / OSM_TILE_SIZE) + 1;

    const tiles: { key: string; url: string; fallbackUrl?: string; left: number; top: number }[] = [];
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const url = getOsmTileUrl(tx, ty, zoom);
        if (!url) continue;
        const fallbackUrl = getOsmFallbackTileUrl(tx, ty, zoom);
        tiles.push({
          key: `${zoom}-${tx}-${ty}`,
          url,
          fallbackUrl,
          left: tx * OSM_TILE_SIZE - topLeftWorldX,
          top: ty * OSM_TILE_SIZE - topLeftWorldY,
        });
      }
    }
    return tiles;
  }, [centerWorld.x, centerWorld.y, size.width, size.height, zoom]);

  const commitPinAtCoords = async (coords: OsmCoordinates) => {
    if (!onPinChangeRef.current) return;
    onPinChangeRef.current(coords);
    setIsReverseGeocoding(true);
    try {
      const geo = await reverseGeocodeOpenStreetMap(coords.lat, coords.lng);
      onPinChangeRef.current?.(coords, { address: geo.address, city: geo.city });
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartWorldRef.current = {
            x: centerWorldRef.current.x,
            y: centerWorldRef.current.y,
          };
        },
        onPanResponderMove: (_evt, gestureState) => {
          if (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4) {
            const nextCenter = worldPixelToLatLng(
              dragStartWorldRef.current.x - gestureState.dx,
              dragStartWorldRef.current.y - gestureState.dy,
              zoomRef.current
            );
            setViewCenter(nextCenter);
          }
        },
        onPanResponderRelease: (evt, gestureState) => {
          const isTap = Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6;
          if (isTap && onPinChangeRef.current) {
            const tapX = evt.nativeEvent.locationX;
            const tapY = evt.nativeEvent.locationY;
            const worldX = centerWorldRef.current.x - sizeRef.current.width / 2 + tapX;
            const worldY = centerWorldRef.current.y - sizeRef.current.height / 2 + tapY;
            const coords = worldPixelToLatLng(worldX, worldY, zoomRef.current);
            commitPinAtCoords(coords);
          }
        },
      }),
    []
  );

  const handleSearch = async () => {
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
    onPinChange?.(coords, { address: item.shortAddress, city: item.city });
  };

  const handleDetectGps = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords: OsmCoordinates = { lat: 31.5204, lng: 74.3587 };
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
      }
      setViewCenter(coords);
      setZoom((z) => Math.max(z, 15));
      const geo = await reverseGeocodeOpenStreetMap(coords.lat, coords.lng);
      onPinChange?.(coords, { address: geo.address, city: geo.city });
      onGpsLocated?.(coords, { address: geo.address, city: geo.city });
    } catch {
      const fallbackGeo = await reverseGeocodeOpenStreetMap(viewCenter.lat, viewCenter.lng);
      onGpsLocated?.(viewCenter, { address: fallbackGeo.address, city: fallbackGeo.city });
    } finally {
      setIsLocating(false);
    }
  };

  const activePinScreen = interactivePin
    ? projectToScreen(interactivePin.lat, interactivePin.lng)
    : null;
  const routeFromScreen = routeLine
    ? projectToScreen(routeLine.from.lat, routeLine.from.lng)
    : null;
  const routeToScreen = routeLine
    ? projectToScreen(routeLine.to.lat, routeLine.to.lng)
    : null;

  const multiStopCoords = useMemo(() => {
    if (!multiStopPoints || multiStopPoints.length < 2) return '';
    return multiStopPoints
      .map((pt) => {
        const p = projectToScreen(pt.lat, pt.lng);
        return `${p.x},${p.y}`;
      })
      .join(' ');
  }, [multiStopPoints, centerWorld.x, centerWorld.y, zoom, size.width, size.height]);

  const activeExternalCoords = interactivePin || (routeLine ? routeLine.to : viewCenter);
  const externalOsmUrl = externalDirectionsOrigin
    ? getOsmDirectionsUrl(externalDirectionsOrigin, activeExternalCoords, zoom)
    : getOsmPlaceUrl(activeExternalCoords.lat, activeExternalCoords.lng, zoom);

  return (
    <View style={styles.wrapper}>
      {(showSearch || showGpsButton) && (
        <View style={styles.controlsHeader}>
          {showSearch && (
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Search size={15} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  placeholder="Search OpenStreetMap street/area..."
                  placeholderTextColor="#94A3B8"
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <X size={14} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.findBtn}
                onPress={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.findBtnText}>Find</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {showGpsButton && (
            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={handleDetectGps}
              disabled={isLocating}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color="#1D4ED8" />
              ) : (
                <LocateFixed size={15} color="#1D4ED8" />
              )}
              <Text style={styles.gpsBtnText}>
                {isLocating ? 'Detecting GPS...' : 'My Current Location (GPS)'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {searchResults.length > 0 && (
        <View style={styles.searchDropdown}>
          {searchResults.slice(0, 4).map((item) => (
            <TouchableOpacity
              key={item.placeId}
              style={styles.searchResultRow}
              onPress={() => handlePickSearchResult(item)}
            >
              <MapPin size={14} color="#EA580C" />
              <View style={{ flex: 1 }}>
                <Text style={styles.searchResultTitle} numberOfLines={1}>
                  {item.shortAddress}
                </Text>
                <Text style={styles.searchResultSub} numberOfLines={1}>
                  {item.displayName}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Map Canvas */}
      <View
        style={[styles.mapBox, { height }]}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (w > 0 && h > 0) setSize({ width: w, height: h });
        }}
        {...panResponder.panHandlers}
      >
        {/* Raster Tiles */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {visibleTiles.map((tile) => (
            <Image
              key={tile.key}
              source={{ uri: failedTiles[tile.key] && tile.fallbackUrl ? tile.fallbackUrl : tile.url }}
              onError={() => {
                if (tile.fallbackUrl && !failedTiles[tile.key]) {
                  setFailedTiles((prev) => ({ ...prev, [tile.key]: true }));
                }
              }}
              style={{
                position: 'absolute',
                left: tile.left,
                top: tile.top,
                width: OSM_TILE_SIZE,
                height: OSM_TILE_SIZE,
              }}
            />
          ))}
        </View>

        {/* Route Polylines */}
        {((routeFromScreen && routeToScreen) || multiStopCoords.length > 0) && (
          <Svg
            width={size.width}
            height={size.height}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {routeFromScreen && routeToScreen && (
              <>
                <Line
                  x1={routeFromScreen.x}
                  y1={routeFromScreen.y}
                  x2={routeToScreen.x}
                  y2={routeToScreen.y}
                  stroke={routeLine?.color || '#EA580C'}
                  strokeWidth={3.5}
                  strokeDasharray="7 5"
                />
                <Circle
                  cx={routeFromScreen.x}
                  cy={routeFromScreen.y}
                  r={5}
                  fill="#FFFFFF"
                  stroke={routeLine?.color || '#EA580C'}
                  strokeWidth={2.5}
                />
                <Circle
                  cx={routeToScreen.x}
                  cy={routeToScreen.y}
                  r={5}
                  fill={routeLine?.color || '#EA580C'}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              </>
            )}

            {multiStopCoords.length > 0 && (
              <Polyline
                points={multiStopCoords}
                fill="none"
                stroke="#0F766E"
                strokeWidth={3.5}
                strokeDasharray="7 5"
              />
            )}
          </Svg>
        )}

        {/* Route Distance Pill */}
        {routeFromScreen && routeToScreen && routeLine?.label && (
          <View
            pointerEvents="none"
            style={[
              styles.routeLabelPill,
              {
                left: (routeFromScreen.x + routeToScreen.x) / 2 - 42,
                top: (routeFromScreen.y + routeToScreen.y) / 2 - 14,
              },
            ]}
          >
            <Text style={styles.routeLabelText}>{routeLine.label}</Text>
          </View>
        )}

        {/* Branch / Customer / Rider Stop Markers */}
        {markers.map((marker) => {
          const pos = projectToScreen(marker.lat, marker.lng);
          const isSelected = marker.id === selectedMarkerId || marker.kind === 'selected_branch';
          const isCustomer = marker.kind === 'customer';
          const isRiderStop = marker.kind === 'rider_stop';

          return (
            <TouchableOpacity
              key={marker.id}
              activeOpacity={0.85}
              onPress={() => {
                setViewCenter({ lat: marker.lat, lng: marker.lng });
                onSelectMarker?.(marker.id);
              }}
              style={[
                styles.markerWrap,
                {
                  left: pos.x - 18,
                  top: pos.y - 36,
                  zIndex: isSelected ? 15 : 10,
                },
              ]}
            >
              {(isSelected || isCustomer || isRiderStop) && (
                <View style={styles.markerTooltip}>
                  <Text style={styles.markerTooltipText} numberOfLines={1}>
                    {marker.title}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.markerCircle,
                  isCustomer && styles.markerCustomer,
                  isRiderStop && styles.markerRider,
                  isSelected && styles.markerSelected,
                ]}
              >
                {isCustomer ? (
                  <Navigation size={14} color="#FFFFFF" />
                ) : (
                  <Store
                    size={15}
                    color={isSelected || isRiderStop ? '#FFFFFF' : '#EA580C'}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Interactive Pin */}
        {activePinScreen && (
          <View
            pointerEvents="none"
            style={[
              styles.pinOverlay,
              {
                left: activePinScreen.x - 19,
                top: activePinScreen.y - 38,
              },
            ]}
          >
            <View style={styles.pinBadge}>
              <Text style={styles.pinBadgeText}>
                {isReverseGeocoding ? 'Resolving...' : 'Pinned'}
              </Text>
            </View>
            <View style={styles.pinCircle}>
              <MapPin size={18} color="#FFFFFF" />
            </View>
          </View>
        )}

        {/* Mode Pill */}
        <View style={styles.modePill}>
          <View style={styles.liveDot} />
          <Text style={styles.modePillText}>{modeLabel}</Text>
        </View>

        {/* Zoom + Recenter Controls */}
        <View style={styles.zoomColumn}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.min(18, z + 1))}
          >
            <Plus size={15} color="#0F172A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.max(5, z - 1))}
          >
            <Minus size={15} color="#0F172A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setViewCenter(interactivePin || center)}
          >
            <Crosshair size={15} color="#EA580C" />
          </TouchableOpacity>
        </View>

        {/* Bottom Coords */}
        <View style={styles.coordsPill}>
          <Text style={styles.coordsText}>
            {(interactivePin || viewCenter).lat.toFixed(4)},{' '}
            {(interactivePin || viewCenter).lng.toFixed(4)}
          </Text>
        </View>

        {/* Bottom Attribution Link */}
        <TouchableOpacity
          style={styles.osmAttribBtn}
          onPress={() => Linking.openURL(externalOsmUrl)}
        >
          <Text style={styles.osmAttribText}>© OpenStreetMap</Text>
          <ExternalLink size={11} color="#EA580C" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: 8,
  },
  controlsHeader: {
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    padding: 0,
  },
  findBtn: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  findBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  gpsBtnText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '800',
  },
  searchDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchResultSub: {
    fontSize: 11,
    color: '#64748B',
  },
  mapBox: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EEF2F6',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    position: 'relative',
  },
  routeLabelPill: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 12,
  },
  routeLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
  },
  markerWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerTooltip: {
    position: 'absolute',
    bottom: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 130,
  },
  markerTooltipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  markerCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerSelected: {
    backgroundColor: '#EA580C',
    borderColor: '#FFFFFF',
  },
  markerCustomer: {
    backgroundColor: '#2563EB',
    borderColor: '#FFFFFF',
  },
  markerRider: {
    backgroundColor: '#0F766E',
    borderColor: '#FFFFFF',
  },
  pinOverlay: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 18,
  },
  pinBadge: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pinBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  pinCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EA580C',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 20,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  zoomColumn: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 5,
    zIndex: 20,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordsPill: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 20,
  },
  coordsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  osmAttribBtn: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    zIndex: 20,
  },
  osmAttribText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
});
