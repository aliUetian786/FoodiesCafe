import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import { KeyboardSafeModal as Modal } from './KeyboardSafeModal';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Branch } from '../types';
import {
  Search,
  Navigation,
  X,
  LocateFixed,
  Map as MapIcon,
} from 'lucide-react-native';
import { OpenStreetMapView } from './OpenStreetMapView';
import { OsmMarkerItem, getOsmDirectionsUrl } from '../utils/openStreetMap';

const { height } = Dimensions.get('window');

interface BranchSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
  orderMode: 'dine_in' | 'takeaway';
  onBranchSelected: (branch: Branch) => void;
}

export function BranchSelectionSheet({
  visible,
  onClose,
  orderMode,
  onBranchSelected,
}: BranchSelectionSheetProps) {
  const {
    branches,
    currentBranch,
    setBranchId,
    customerCoordinates,
    calculateDistanceKm,
    detectAndStoreCurrentLocation,
    showToast,
    setBottomSheetOpen,
  } = useApp();

  const [showOsmBranchMap, setShowOsmBranchMap] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setBottomSheetOpen(true);
    return () => {
      setBottomSheetOpen(false);
    };
  }, [visible, setBottomSheetOpen]);

  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectBranch = (branch: Branch) => {
    if (!branch.isOpen) {
      showToast(
        `⛔ ${branch.name} is currently Closed / Offline. You cannot proceed with this branch. Please choose an open branch.`,
        'danger'
      );
      return;
    }
    setBranchId(branch.id);
    onBranchSelected(branch);
    showToast(
      `${orderMode === 'dine_in' ? 'Dine-In' : 'Takeaway'} at ${branch.name}`,
      'success'
    );
  };

  const handleOpenDirections = (e: any, branch: Branch) => {
    e.stopPropagation?.();
    const lat = Number(branch.latitude) || (branch.city === 'Islamabad' ? 33.7215 : branch.city === 'Karachi' ? 24.8252 : 31.5126);
    const lng = Number(branch.longitude) || (branch.city === 'Islamabad' ? 73.0552 : branch.city === 'Karachi' ? 67.0305 : 74.3436);
    const url = getOsmDirectionsUrl(customerCoordinates, { lat, lng });
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          showToast(`OpenStreetMap: ${branch.name} (${lat}, ${lng})`, 'info');
        }
      })
      .catch(() => {
        showToast(`Destination: ${branch.name}`, 'info');
      });
  };

  // Sort branches distance-wise: Nearest branch at the top, others below it
  const sortedBranches = useMemo(() => {
    const listWithDist = branches.map((b) => {
      const bLat = Number(b.latitude) || (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126);
      const bLng = Number(b.longitude) || (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436);

      const dist = calculateDistanceKm(
        customerCoordinates.lat,
        customerCoordinates.lng,
        bLat,
        bLng
      );
      return { branch: b, dist };
    });

    // Sort ascending by distance (nearest at top)
    listWithDist.sort((a, b) => a.dist - b.dist);

    if (!searchQuery.trim()) return listWithDist;

    const q = searchQuery.toLowerCase().trim();
    return listWithDist.filter(
      ({ branch }) =>
        branch.name.toLowerCase().includes(q) ||
        branch.city.toLowerCase().includes(q) ||
        branch.address.toLowerCase().includes(q)
    );
  }, [branches, customerCoordinates, searchQuery, calculateDistanceKm]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent={true} navigationBarTranslucent={true}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        {/* Bottom sheet covering 60 to 70% of screen height */}
        <View style={styles.sheetContainer}>
          {/* Top Row: Search row option only */}
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search branch or city..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* OpenStreetMap Branch Map Toolbar & Map */}
          <View style={styles.osmControlsBar}>
            <TouchableOpacity
              style={[styles.osmToggleBtn, showOsmBranchMap && styles.osmToggleBtnActive]}
              onPress={() => setShowOsmBranchMap((prev) => !prev)}
            >
              <MapIcon size={13} color={showOsmBranchMap ? '#EA580C' : Colors.textMain} />
              <Text style={[styles.osmToggleText, showOsmBranchMap && styles.osmToggleTextActive]}>
                {showOsmBranchMap ? 'Hide OpenStreetMap' : 'Show Branches on OpenStreetMap'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gpsDetectBtn}
              onPress={async () => {
                const res = await detectAndStoreCurrentLocation();
                if (res) {
                  showToast(`Current GPS stored: ${res.address}`, 'success');
                }
              }}
            >
              <LocateFixed size={13} color="#1D4ED8" />
              <Text style={styles.gpsDetectText}>Detect GPS</Text>
            </TouchableOpacity>
          </View>

          {showOsmBranchMap && (
            <View style={{ marginBottom: 10 }}>
              <OpenStreetMapView
                center={
                  sortedBranches[0]
                    ? {
                        lat:
                          Number(sortedBranches[0].branch.latitude) ||
                          (sortedBranches[0].branch.city === 'Islamabad'
                            ? 33.7215
                            : sortedBranches[0].branch.city === 'Karachi'
                            ? 24.8252
                            : 31.5126),
                        lng:
                          Number(sortedBranches[0].branch.longitude) ||
                          (sortedBranches[0].branch.city === 'Islamabad'
                            ? 73.0552
                            : sortedBranches[0].branch.city === 'Karachi'
                            ? 67.0305
                            : 74.3436),
                      }
                    : customerCoordinates
                }
                zoom={12}
                height={185}
                markers={[
                  ...sortedBranches.map(
                    ({ branch: b, dist }): OsmMarkerItem => ({
                      id: b.id,
                      lat:
                        Number(b.latitude) ||
                        (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126),
                      lng:
                        Number(b.longitude) ||
                        (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436),
                      title: `${b.name} (${dist} km)`,
                      kind: b.id === currentBranch.id ? 'selected_branch' : 'branch',
                    })
                  ),
                  {
                    id: 'cust-sheet-loc',
                    lat: customerCoordinates.lat,
                    lng: customerCoordinates.lng,
                    title: 'Your Location',
                    kind: 'customer',
                  },
                ]}
                selectedMarkerId={currentBranch.id}
                onSelectMarker={(id) => {
                  const found = branches.find((b) => b.id === id);
                  if (found) handleSelectBranch(found);
                }}
                showSearch={false}
                showGpsButton={false}
                modeLabel="OpenStreetMap • Branch View"
              />
            </View>
          )}

          {/* Scrollable branch list beneath the search row */}
          <ScrollView
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.listContent}
            style={styles.scrollContainer}
          >
            {sortedBranches.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No branches matching "{searchQuery}"</Text>
              </View>
            ) : (
              sortedBranches.map(({ branch: b, dist }, index) => {
                const isSelected = b.id === currentBranch.id;
                const isNearest = index === 0 && !searchQuery.trim();

                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[
                      styles.branchCard,
                      isSelected && styles.branchCardSelected,
                      !b.isOpen && styles.branchCardClosed,
                    ]}
                    onPress={() => handleSelectBranch(b)}
                    activeOpacity={b.isOpen ? 0.88 : 0.6}
                  >
                    {/* Line 1: Name of branch */}
                    <View style={styles.nameRow}>
                      <Text
                        style={[
                          styles.branchName,
                          isSelected && styles.branchNameSelected,
                          !b.isOpen && styles.branchNameClosed,
                        ]}
                      >
                        {b.name}
                      </Text>
                      {!b.isOpen ? (
                        <View style={styles.closedPillBadge}>
                          <Text style={styles.closedPillText}>Closed / Offline</Text>
                        </View>
                      ) : isNearest ? (
                        <View style={styles.nearestBadge}>
                          <Text style={styles.nearestBadgeText}>Nearest</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Line 2: Below that, branch address */}
                    <Text style={[styles.branchAddress, !b.isOpen && styles.branchAddressClosed]} numberOfLines={1}>
                      {b.address}, {b.city}
                    </Text>

                    {/* Line 3: Distance from customer, open/close status, and at end of third line (right corner): direction sign */}
                    <View style={styles.thirdLineRow}>
                      <View style={styles.metaLeftCol}>
                        <Text style={styles.distanceText}>{dist} km away</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text
                          style={[
                            styles.statusText,
                            b.isOpen ? styles.statusOpen : styles.statusClosed,
                          ]}
                        >
                          {b.isOpen ? '🟢 Open Now' : '🔴 Closed / Offline (Cannot Order)'}
                        </Text>
                      </View>

                      {/* Right corner of third line: Direction sign for that branch */}
                      <TouchableOpacity
                        style={styles.directionSignBtn}
                        onPress={(e) => handleOpenDirections(e, b)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Navigation size={15} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    height: height * 0.78,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  osmControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  osmToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.bgMain,
  },
  osmToggleBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  osmToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
  osmToggleTextActive: {
    color: '#EA580C',
  },
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  gpsDetectText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgMain,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMain,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bgMain,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  branchCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  branchCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF7F2',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  branchName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMain,
    flex: 1,
  },
  branchNameSelected: {
    color: Colors.primary,
  },
  nearestBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  nearestBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  branchAddress: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: 6,
  },
  thirdLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  metaLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMain,
  },
  metaDot: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusOpen: {
    color: '#059669',
  },
  statusClosed: {
    color: '#DC2626',
  },
  branchCardClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    opacity: 0.85,
  },
  branchNameClosed: {
    color: '#991B1B',
  },
  branchAddressClosed: {
    color: '#B91C1C',
  },
  closedPillBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  closedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  directionSignBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
