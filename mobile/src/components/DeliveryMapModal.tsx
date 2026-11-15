import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Switch,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { SavedDeliveryAddress, Branch } from '../types';
import {
  MapPin,
  Plus,
  Check,
  X,
  Navigation,
  Building,
  Home,
  Briefcase,
  Trash2,
  Compass,
  ArrowLeft,
  Sparkles,
} from 'lucide-react-native';
import { OpenStreetMapView } from './OpenStreetMapView';

const { width, height } = Dimensions.get('window');

interface DeliveryMapModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmDelivery: (address: string, branch: Branch) => void;
}

// Preset locations in Lahore with realistic coordinates
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

export function DeliveryMapModal({
  visible,
  onClose,
  onConfirmDelivery,
}: DeliveryMapModalProps) {
  const {
    branches,
    savedAddresses,
    addSavedAddress,
    deleteSavedAddress,
    customerCoordinates,
    setCustomerCoordinates,
    selectedDeliveryAddress,
    setSelectedDeliveryAddress,
    calculateDistanceKm,
    setBranchId,
    showToast,
    setBottomSheetOpen,
  } = useApp();

  // Mode: always default to 'map' so OpenStreetMap opens directly on delivery selection
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [selectedSavedId, setSelectedSavedId] = useState<string>(
    savedAddresses[0]?.id || ''
  );

  // OpenStreetMap Interactive Pin coordinates
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number }>(
    customerCoordinates || { lat: 31.5204, lng: 74.3587 }
  );
  const [pinCity, setPinCity] = useState<string>('Lahore');
  const [pinConfirmed, setPinConfirmed] = useState(false);

  // Written Address input (auto-fetched from OpenStreetMap, editable)
  const [writtenAddress, setWrittenAddress] = useState(
    selectedDeliveryAddress || 'House #14, Street 5, Gulberg III, Lahore'
  );
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [saveToProfile, setSaveToProfile] = useState(true);

  // Sync state when modal becomes visible: ALWAYS open in 'map' mode first
  useEffect(() => {
    if (!visible) return;
    setBottomSheetOpen(true);
    setViewMode('map');
    setPinConfirmed(false);
    if (customerCoordinates) {
      setPinCoords(customerCoordinates);
    }
    if (selectedDeliveryAddress) {
      setWrittenAddress(selectedDeliveryAddress);
    }
    if (savedAddresses.length > 0) {
      setSelectedSavedId(savedAddresses[0].id);
    }
    return () => {
      setBottomSheetOpen(false);
    };
  }, [visible, savedAddresses.length, setBottomSheetOpen, customerCoordinates, selectedDeliveryAddress]);

  // Find nearest branch to coordinates
  const findNearestBranch = (coords: { lat: number; lng: number }): { branch: Branch; dist: number } => {
    let nearest = branches[0];
    let minD = 999999;
    branches.forEach((b) => {
      const d = calculateDistanceKm(
        coords.lat,
        coords.lng,
        b.coordinates?.lat ?? b.latitude ?? 31.5204,
        b.coordinates?.lng ?? b.longitude ?? 74.3587
      );
      if (d < minD) {
        minD = d;
        nearest = b;
      }
    });
    return { branch: nearest, dist: minD };
  };

  const currentNearest = findNearestBranch(pinCoords);

  // Auto-fetch written address when zone or pin changes
  const handleSelectZone = (zone: (typeof PRESET_ZONES)[0]) => {
    setPinCoords(zone.coords);
    setWrittenAddress(`House #, ${zone.area}, Lahore`);
  };

  // Step 1 on Map: Confirm Pin Location
  const handleConfirmPinLocation = () => {
    setPinConfirmed(true);
    showToast('Location confirmed on map! Review written address below.', 'info');
  };

  // Step 2 on Map: Confirm Written Address & Store Current Location
  const handleFinalizeNewAddress = () => {
    if (!writtenAddress.trim()) {
      showToast('Please enter your delivery address lines', 'warning');
      return;
    }

    const cleanAddr = writtenAddress.trim();
    setCustomerCoordinates(pinCoords);
    setSelectedDeliveryAddress(cleanAddr);

    if (saveToProfile) {
      addSavedAddress({
        label: addressLabel,
        address: cleanAddr,
        city: pinCity || 'Lahore',
        coordinates: pinCoords,
        isDefault: false,
      });
    }

    setBranchId(currentNearest.branch.id);
    onConfirmDelivery(cleanAddr, currentNearest.branch);
  };

  // Confirming from existing saved addresses list
  const handleConfirmSavedAddress = () => {
    const selected = savedAddresses.find((a) => a.id === selectedSavedId) || savedAddresses[0];
    if (!selected) {
      setViewMode('map');
      return;
    }
    const coords = selected.coordinates || { lat: 31.5204, lng: 74.3587 };
    const { branch } = findNearestBranch(coords);

    setCustomerCoordinates(coords);
    setSelectedDeliveryAddress(selected.address);
    setBranchId(branch.id);
    onConfirmDelivery(selected.address, branch);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent={true} navigationBarTranslucent={true}>
      <View style={styles.backdrop}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {viewMode === 'map' && savedAddresses.length > 0 && (
                <TouchableOpacity
                  onPress={() => setViewMode('list')}
                  style={styles.backBtn}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={18} color={Colors.textMain} />
                </TouchableOpacity>
              )}
              <View>
                <Text style={styles.headerTitle}>
                  {viewMode === 'list' ? 'Delivery Address' : 'Pin Delivery Location'}
                </Text>
                <Text style={styles.headerSub}>
                  {viewMode === 'list'
                    ? 'Choose a saved address or add a new delivery location'
                    : 'Interactive Map: Drag pin & verify address'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ================= VIEW 1: SAVED ADDRESSES LIST ================= */}
          {viewMode === 'list' ? (
            <ScrollView
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionHeading}>Your Saved Addresses</Text>

              {savedAddresses.map((addr) => {
                const isSelected = addr.id === selectedSavedId;
                const coords = addr.coordinates || { lat: 31.5204, lng: 74.3587 };
                const { branch, dist } = findNearestBranch(coords);

                return (
                  <TouchableOpacity
                    key={addr.id}
                    style={[styles.savedCard, isSelected && styles.savedCardSelected]}
                    onPress={() => setSelectedSavedId(addr.id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.savedCardTop}>
                      <View style={styles.labelRow}>
                        {addr.label === 'Home' ? (
                          <Home size={15} color={isSelected ? Colors.primary : Colors.textMuted} />
                        ) : addr.label === 'Work' ? (
                          <Briefcase size={15} color={isSelected ? Colors.primary : Colors.textMuted} />
                        ) : (
                          <Building size={15} color={isSelected ? Colors.primary : Colors.textMuted} />
                        )}
                        <Text style={[styles.labelText, isSelected && styles.labelTextActive]}>
                          {addr.label}
                        </Text>
                      </View>

                      <View style={styles.actionIcons}>
                        {isSelected && (
                          <View style={styles.checkPill}>
                            <Check size={12} color={Colors.primary} />
                            <Text style={styles.checkPillText}>Selected</Text>
                          </View>
                        )}
                        {savedAddresses.length > 1 && (
                          <TouchableOpacity
                            onPress={() => deleteSavedAddress(addr.id)}
                            style={styles.deleteBtn}
                          >
                            <Trash2 size={14} color={Colors.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <Text style={styles.savedAddressText}>{addr.address}</Text>

                    <View style={styles.branchServedRow}>
                      <Navigation size={11} color={Colors.primary} />
                      <Text style={styles.branchServedText}>
                        Fulfilled by: {branch.name} ({dist} km away)
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* + Add Another Address Button */}
              <TouchableOpacity
                style={styles.addAnotherBtn}
                onPress={() => {
                  setViewMode('map');
                  setPinConfirmed(false);
                }}
                activeOpacity={0.85}
              >
                <Plus size={16} color={Colors.primary} />
                <Text style={styles.addAnotherText}>+ Add Another Address</Text>
              </TouchableOpacity>

              {/* Confirm Selected Address */}
              <TouchableOpacity
                style={styles.confirmSelectionBtn}
                onPress={handleConfirmSavedAddress}
                activeOpacity={0.88}
              >
                <Check size={16} color={Colors.textWhite} />
                <Text style={styles.confirmSelectionText}>Confirm Delivery to This Address</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* ================= VIEW 2: INTERACTIVE MAP & WRITTEN ADDRESS ================= */
            <ScrollView
              contentContainerStyle={styles.mapScrollContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Live OpenStreetMap Canvas + Search + GPS */}
              <OpenStreetMapView
                center={pinCoords}
                zoom={14}
                height={250}
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
                  setCustomerCoordinates(coords);
                  if (geo?.address) setSelectedDeliveryAddress(geo.address);
                  showToast(`GPS stored on OpenStreetMap: ${geo?.address || 'Location detected'}`, 'success');
                }}
                markers={[
                  {
                    id: 'nearest-fulfill-branch',
                    lat: Number(currentNearest.branch.latitude) || currentNearest.branch.coordinates?.lat || 31.5126,
                    lng: Number(currentNearest.branch.longitude) || currentNearest.branch.coordinates?.lng || 74.3436,
                    title: currentNearest.branch.name,
                    kind: 'selected_branch',
                  },
                ]}
                routeLine={{
                  from: {
                    lat: Number(currentNearest.branch.latitude) || currentNearest.branch.coordinates?.lat || 31.5126,
                    lng: Number(currentNearest.branch.longitude) || currentNearest.branch.coordinates?.lng || 74.3436,
                  },
                  to: pinCoords,
                  label: `${currentNearest.dist} km`,
                }}
                showSearch={true}
                showGpsButton={true}
                modeLabel="OpenStreetMap • Tap Anywhere to Pin"
              />

              {/* Location Selectors: If location already saved, show "Use already saved location", otherwise "Tap Quick Area Preset" */}
              {savedAddresses.length > 0 ? (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.subLabel}>Use Already Saved Location:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.zonesRow}
                  >
                    {savedAddresses.map((addr) => {
                      const isAddrActive =
                        (addr.coordinates &&
                          Math.abs(addr.coordinates.lat - pinCoords.lat) < 0.001 &&
                          Math.abs(addr.coordinates.lng - pinCoords.lng) < 0.001) ||
                        selectedSavedId === addr.id;

                      return (
                        <TouchableOpacity
                          key={addr.id}
                          style={[styles.zoneChip, isAddrActive && styles.zoneChipActive]}
                          onPress={() => {
                            setSelectedSavedId(addr.id);
                            if (addr.coordinates) {
                              setPinCoords(addr.coordinates);
                            }
                            setWrittenAddress(addr.address);
                            if (addr.label === 'Home' || addr.label === 'Work' || addr.label === 'Other') {
                              setAddressLabel(addr.label);
                            }
                            showToast(`Selected saved location: ${addr.label}`, 'info');
                          }}
                          activeOpacity={0.8}
                        >
                          {addr.label === 'Home' ? (
                            <Home size={12} color={isAddrActive ? Colors.textWhite : Colors.primary} />
                          ) : addr.label === 'Work' ? (
                            <Briefcase size={12} color={isAddrActive ? Colors.textWhite : Colors.primary} />
                          ) : (
                            <Building size={12} color={isAddrActive ? Colors.textWhite : Colors.primary} />
                          )}
                          <Text
                            style={[
                              styles.zoneChipText,
                              isAddrActive && styles.zoneChipTextActive,
                            ]}
                          >
                            {addr.label}: {addr.address}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.subLabel}>Tap Quick Area Preset:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.zonesRow}
                  >
                    {PRESET_ZONES.map((zone) => {
                      const isZoneActive =
                        Math.abs(zone.coords.lat - pinCoords.lat) < 0.005 &&
                        Math.abs(zone.coords.lng - pinCoords.lng) < 0.005;

                      return (
                        <TouchableOpacity
                          key={zone.name}
                          style={[styles.zoneChip, isZoneActive && styles.zoneChipActive]}
                          onPress={() => handleSelectZone(zone)}
                          activeOpacity={0.8}
                        >
                          <MapPin
                            size={12}
                            color={isZoneActive ? Colors.textWhite : Colors.textMuted}
                          />
                          <Text
                            style={[
                              styles.zoneChipText,
                              isZoneActive && styles.zoneChipTextActive,
                            ]}
                          >
                            {zone.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Pin Confirm Button if not confirmed yet */}
              {!pinConfirmed ? (
                <TouchableOpacity
                  style={styles.confirmPinBtn}
                  onPress={handleConfirmPinLocation}
                  activeOpacity={0.85}
                >
                  <Check size={16} color={Colors.textWhite} />
                  <Text style={styles.confirmPinText}>Confirm Pin Location on Map</Text>
                </TouchableOpacity>
              ) : null}

              {/* ================= STEP 2: WRITTEN ADDRESS SECTION ================= */}
              {pinConfirmed && (
                <View style={styles.writtenSection}>
                  <View style={styles.writtenHeader}>
                    <Text style={styles.writtenTitle}>Written Address Lines</Text>
                    <Text style={styles.writtenNotice}>Auto-fetched • You can edit/overwrite</Text>
                  </View>

                  {/* Editable Written Address Input */}
                  <TextInput
                    style={styles.addressInput}
                    value={writtenAddress}
                    onChangeText={setWrittenAddress}
                    placeholder="e.g. House #14, Street 5, Gulberg III, Lahore"
                    multiline
                    numberOfLines={3}
                  />

                  {/* Label Selector: Home, Work, Other */}
                  <Text style={styles.subLabel}>Address Label:</Text>
                  <View style={styles.labelPickerRow}>
                    {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                      <TouchableOpacity
                        key={lbl}
                        style={[
                          styles.labelOption,
                          addressLabel === lbl && styles.labelOptionActive,
                        ]}
                        onPress={() => setAddressLabel(lbl)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.labelOptionText,
                            addressLabel === lbl && styles.labelOptionTextActive,
                          ]}
                        >
                          {lbl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Save to Profile Toggle */}
                  <View style={styles.saveToggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.saveToggleTitle}>Save Address in Profile</Text>
                      <Text style={styles.saveToggleSub}>
                        Save to your account for 1-tap future delivery orders
                      </Text>
                    </View>
                    <Switch
                      value={saveToProfile}
                      onValueChange={setSaveToProfile}
                      trackColor={{ false: Colors.borderColor, true: Colors.primary }}
                    />
                  </View>

                  {/* Nearest Branch Info Card */}
                  <View style={styles.nearestBranchCard}>
                    <View style={styles.nearestTop}>
                      <Navigation size={14} color={Colors.primary} />
                      <Text style={styles.nearestTitle}>Nearest Branch for Fulfillment</Text>
                    </View>
                    <Text style={styles.nearestName}>
                      {currentNearest.branch.name} • {currentNearest.dist} km
                    </Text>
                    <Text style={styles.nearestNotice}>
                      {currentNearest.branch.isOpen
                        ? '🟢 Open & accepting live delivery orders'
                        : '🔴 Branch closed • pre-orders accepted'}
                    </Text>
                  </View>

                  {/* Confirm & Deliver Button */}
                  <TouchableOpacity
                    style={styles.finalizeBtn}
                    onPress={handleFinalizeNewAddress}
                    activeOpacity={0.88}
                  >
                    <Check size={16} color={Colors.textWhite} />
                    <Text style={styles.finalizeBtnText}>Confirm Delivery & Continue</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
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
  modalSheet: {
    maxHeight: height * 0.88,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  backBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgMain,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgMain,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 20,
    gap: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    padding: 14,
    gap: 6,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  savedCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF7F2',
  },
  savedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  labelTextActive: {
    color: Colors.primary,
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  checkPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  deleteBtn: {
    padding: 4,
  },
  savedAddressText: {
    fontSize: 12.5,
    color: Colors.textMain,
    lineHeight: 18,
  },
  branchServedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  branchServedText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  addAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: Colors.primaryLight,
    marginTop: 4,
  },
  addAnotherText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  confirmSelectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    elevation: 3,
  },
  confirmSelectionText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textWhite,
  },

  // Map Canvas & Written View Styles
  mapScrollContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  mapCanvas: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    marginBottom: 12,
  },
  mapFloatingBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  mapFloatingText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#EA580C',
  },
  gpsLocateBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    elevation: 2,
  },
  gpsLocateText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  zonesRow: {
    gap: 8,
    paddingBottom: 12,
  },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgMain,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  zoneChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  zoneChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMain,
  },
  zoneChipTextActive: {
    color: Colors.textWhite,
    fontWeight: '700',
  },
  confirmPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
    elevation: 2,
  },
  confirmPinText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },

  // Written Address Section
  writtenSection: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    gap: 10,
  },
  writtenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  writtenTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  writtenNotice: {
    fontSize: 10.5,
    color: Colors.primary,
    fontWeight: '600',
  },
  addressInput: {
    backgroundColor: Colors.bgMain,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: Colors.textMain,
    textAlignVertical: 'top',
  },
  labelPickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  labelOption: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.bgMain,
  },
  labelOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  labelOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  labelOptionTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  saveToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  saveToggleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  saveToggleSub: {
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  nearestBranchCard: {
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  nearestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nearestTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  nearestName: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  nearestNotice: {
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  finalizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
    elevation: 3,
  },
  finalizeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textWhite,
  },
});
