import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Linking,
} from 'react-native';
import { KeyboardSafeModal as Modal } from '../components/KeyboardSafeModal';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Branch } from '../types';
import {
  Building2,
  MapPin,
  Phone,
  Clock,
  Plus,
  Minus,
  Check,
  X,
  Edit2,
  Flame,
  Bike,
  ExternalLink,
} from 'lucide-react-native';
import { OpenStreetMapView } from '../components/OpenStreetMapView';
import { getOsmPlaceUrl } from '../utils/openStreetMap';

export function OwnerBranches() {
  const { branches, updateBranchSettings, toggleBranchStatus, createBranch, showToast, setBottomSheetOpen } = useApp();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('Lahore');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('+92 300 ');
  const [newBranchHours, setNewBranchHours] = useState('11:00 AM - 1:00 AM');
  const [newBranchCoords, setNewBranchCoords] = useState({ lat: 31.5126, lng: 74.3436 });

  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editCoords, setEditCoords] = useState({ lat: 31.5126, lng: 74.3436 });

  useEffect(() => {
    if (!addModalOpen && !editBranch) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [addModalOpen, editBranch, setBottomSheetOpen]);

  const handleAdjustDistance = (branchId: string, delta: number) => {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;
    const current = branch.maxOrderDistanceKm || 50;
    const nextVal = Math.max(10, Math.min(100, current + delta));
    updateBranchSettings(branchId, { maxOrderDistanceKm: nextVal });
  };

  const handleAdjustTableQrRadius = (branchId: string, delta: number) => {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;
    const current = branch.tableQrMaxDistanceMeters || 300;
    const nextVal = Math.max(50, Math.min(1000, current + delta));
    updateBranchSettings(branchId, { tableQrMaxDistanceMeters: nextVal });
  };

  const handleAdjustPrepTime = (branchId: string, delta: number) => {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;
    const current = branch.prepTimeEstimateMin || 25;
    const nextVal = Math.max(10, Math.min(90, current + delta));
    updateBranchSettings(branchId, { prepTimeEstimateMin: nextVal });
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      showToast('Please enter a branch name', 'warning');
      return;
    }
    const success = await createBranch({
      name: newBranchName.trim(),
      city: newBranchCity,
      address: newBranchAddress.trim(),
      phone: newBranchPhone.trim(),
      openingHours: newBranchHours.trim(),
      latitude: newBranchCoords.lat,
      longitude: newBranchCoords.lng,
      isOpen: true,
      isBusy: false,
      deliveryEnabled: true,
      maxOrderDistanceKm: 50,
      tableQrMaxDistanceMeters: 300,
    });
    if (success) {
      setAddModalOpen(false);
      setNewBranchName('');
      setNewBranchAddress('');
    }
  };

  const handleOpenEdit = (b: Branch) => {
    setEditBranch(b);
    setEditName(b.name);
    setEditAddress(b.address);
    setEditPhone(b.phone);
    setEditHours(b.openingHours);
    setEditCoords({
      lat: Number(b.latitude) || b.coordinates?.lat || (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126),
      lng: Number(b.longitude) || b.coordinates?.lng || (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436),
    });
  };

  const handleSaveEdit = () => {
    if (!editBranch) return;
    updateBranchSettings(editBranch.id, {
      name: editName.trim(),
      address: editAddress.trim(),
      phone: editPhone.trim(),
      openingHours: editHours.trim(),
      latitude: editCoords.lat,
      longitude: editCoords.lng,
    });
    showToast(`Branch ${editName} location & details updated!`, 'success');
    setEditBranch(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Branch Governance</Text>
          <Text style={styles.pageSub}>
            Multi-branch operational parameters & delivery geofences
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalOpen(true)}>
          <Plus size={15} color="#FFFFFF" />
          <Text style={styles.addBtnText}>+ Add Branch</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.branchList}>
        {branches.map((b) => (
          <View key={b.id} style={styles.branchCard}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.iconTitleRow}>
                <View style={styles.iconWrap}>
                  <Building2 size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.branchName}>{b.name}</Text>
                  <Text style={styles.branchCity}>{b.city}</Text>
                </View>
              </View>

              <View style={styles.headerActionRow}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => handleOpenEdit(b)}
                >
                  <Edit2 size={12} color={Colors.primary} />
                </TouchableOpacity>

                {/* Open / Closed Switch */}
                <View style={styles.statusSwitchWrap}>
                  <Text
                    style={[
                      styles.statusText,
                      { color: b.isOpen ? Colors.success : Colors.danger },
                    ]}
                  >
                    {b.isOpen ? 'ONLINE' : 'CLOSED'}
                  </Text>
                  <Switch
                    value={b.isOpen}
                    onValueChange={() => toggleBranchStatus(b.id)}
                    trackColor={{ false: Colors.dangerLight, true: Colors.successLight }}
                    thumbColor={b.isOpen ? Colors.success : Colors.danger}
                  />
                </View>
              </View>
            </View>

            {/* Info details */}
            <View style={styles.detailsBox}>
              <View style={styles.detailRow}>
                <MapPin size={12} color={Colors.textMuted} />
                <Text style={styles.detailText}>{b.address}</Text>
              </View>
              <View style={styles.detailRow}>
                <Phone size={12} color={Colors.textMuted} />
                <Text style={styles.detailText}>{b.phone}</Text>
              </View>
              <View style={styles.detailRow}>
                <Clock size={12} color={Colors.textMuted} />
                <Text style={styles.detailText}>{b.openingHours}</Text>
              </View>
              <TouchableOpacity
                style={styles.osmCardBtn}
                onPress={() => {
                  const lat = Number(b.latitude) || b.coordinates?.lat || 31.5126;
                  const lng = Number(b.longitude) || b.coordinates?.lng || 74.3436;
                  Linking.openURL(getOsmPlaceUrl(lat, lng));
                }}
              >
                <ExternalLink size={12} color="#EA580C" />
                <Text style={styles.osmCardBtnText}>
                  View Branch on OpenStreetMap ({(Number(b.latitude) || 31.5126).toFixed(4)}, {(Number(b.longitude) || 74.3436).toFixed(4)})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Controls */}
            <View style={styles.controlsSection}>
              {/* Rush Hour / Busy Toggle */}
              <View style={styles.controlRow}>
                <View>
                  <Text style={styles.controlLabel}>Rush Hour / Busy Mode</Text>
                  <Text style={styles.controlSub}>Displays delay warning to customers</Text>
                </View>
                <Switch
                  value={b.isBusy}
                  onValueChange={(val) => updateBranchSettings(b.id, { isBusy: val })}
                  trackColor={{ false: Colors.borderColor, true: Colors.primary }}
                />
              </View>

              {/* Prep Time Stepper */}
              <View style={styles.controlRow}>
                <View>
                  <Text style={styles.controlLabel}>Kitchen Prep Estimate</Text>
                  <Text style={styles.controlSub}>Standard wait time</Text>
                </View>
                <View style={styles.stepperWrap}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => handleAdjustPrepTime(b.id, -5)}
                  >
                    <Minus size={13} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{b.prepTimeEstimateMin || 25}m</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => handleAdjustPrepTime(b.id, 5)}
                  >
                    <Plus size={13} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Max Delivery Radius */}
              <View style={styles.controlRow}>
                <View>
                  <Text style={styles.controlLabel}>Max Order Distance</Text>
                  <Text style={styles.controlSub}>Delivery boundary from cafe</Text>
                </View>
                <View style={styles.stepperWrap}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => handleAdjustDistance(b.id, -5)}
                  >
                    <Minus size={13} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{b.maxOrderDistanceKm || 50} km</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => handleAdjustDistance(b.id, 5)}
                  >
                    <Plus size={13} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Table QR In-Store Distance */}
              <View style={styles.controlRow}>
                <View>
                  <Text style={styles.controlLabel}>In-Store Table QR Radius</Text>
                  <Text style={styles.controlSub}>GPS check to prevent remote ordering</Text>
                </View>
                <View style={styles.stepperWrap}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => handleAdjustTableQrRadius(b.id, -50)}
                  >
                    <Minus size={13} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{b.tableQrMaxDistanceMeters || 300}m</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => handleAdjustTableQrRadius(b.id, 50)}
                  >
                    <Plus size={13} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Delivery Enabled Toggle */}
              <View style={[styles.controlRow, { borderBottomWidth: 0 }]}>
                <View>
                  <Text style={styles.controlLabel}>Doorstep Delivery Service</Text>
                  <Text style={styles.controlSub}>Allow riders to accept doorstep dispatches</Text>
                </View>
                <Switch
                  value={b.deliveryEnabled}
                  onValueChange={(val) => updateBranchSettings(b.id, { deliveryEnabled: val })}
                  trackColor={{ false: Colors.borderColor, true: Colors.primary }}
                />
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* MODAL 1: ADD NEW BRANCH */}
      <Modal visible={addModalOpen} transparent animationType="slide" statusBarTranslucent={true} navigationBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Branch</Text>
              <TouchableOpacity onPress={() => setAddModalOpen(false)}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Branch Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={newBranchName}
                onChangeText={setNewBranchName}
                placeholder="e.g. DHA Phase 5 Express"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.inputLabel}>City *</Text>
              <View style={styles.cityRow}>
                {['Lahore', 'Islamabad', 'Karachi', 'Rawalpindi'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.cityPill, newBranchCity === c && styles.cityPillActive]}
                    onPress={() => setNewBranchCity(c)}
                  >
                    <Text
                      style={[
                        styles.cityPillText,
                        newBranchCity === c && styles.cityPillTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Street Address</Text>
              <TextInput
                style={styles.modalInput}
                value={newBranchAddress}
                onChangeText={setNewBranchAddress}
                placeholder="e.g. Plot 12, Commercial Area, DHA"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.inputLabel}>Pin Branch Location on OpenStreetMap</Text>
              <View style={{ marginBottom: 10 }}>
                <OpenStreetMapView
                  center={newBranchCoords}
                  zoom={14}
                  height={180}
                  interactivePin={newBranchCoords}
                  onPinChange={(coords, geo) => {
                    setNewBranchCoords(coords);
                    if (geo?.address && !newBranchAddress.trim()) setNewBranchAddress(geo.address);
                  }}
                  onGpsLocated={(coords, geo) => {
                    setNewBranchCoords(coords);
                    if (geo?.address) setNewBranchAddress(geo.address);
                  }}
                  showSearch={true}
                  showGpsButton={true}
                  modeLabel="Tap OpenStreetMap to Pin Branch"
                />
              </View>

              <Text style={styles.inputLabel}>Official Contact Phone</Text>
              <TextInput
                style={styles.modalInput}
                value={newBranchPhone}
                onChangeText={setNewBranchPhone}
                placeholder="+92 300 1234567"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.inputLabel}>Opening Hours</Text>
              <TextInput
                style={styles.modalInput}
                value={newBranchHours}
                onChangeText={setNewBranchHours}
                placeholder="11:00 AM - 1:00 AM"
                placeholderTextColor={Colors.textMuted}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setAddModalOpen(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleCreateBranch}>
                  <Check size={14} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Branch</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: EDIT BRANCH DETAILS */}
      <Modal visible={!!editBranch} transparent animationType="fade" statusBarTranslucent={true} navigationBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Branch & OpenStreetMap Location</Text>
              <TouchableOpacity onPress={() => setEditBranch(null)}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Branch Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
              />

              <Text style={styles.inputLabel}>Street Address</Text>
              <TextInput
                style={styles.modalInput}
                value={editAddress}
                onChangeText={setEditAddress}
              />

              <Text style={styles.inputLabel}>Update Branch Pin on OpenStreetMap</Text>
              <View style={{ marginBottom: 10 }}>
                <OpenStreetMapView
                  center={editCoords}
                  zoom={14}
                  height={180}
                  interactivePin={editCoords}
                  onPinChange={(coords, geo) => {
                    setEditCoords(coords);
                    if (geo?.address) setEditAddress(geo.address);
                  }}
                  onGpsLocated={(coords, geo) => {
                    setEditCoords(coords);
                    if (geo?.address) setEditAddress(geo.address);
                  }}
                  showSearch={true}
                  showGpsButton={true}
                  modeLabel="Tap OpenStreetMap to Move Pin"
                />
              </View>

              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
              />

              <Text style={styles.inputLabel}>Opening Hours</Text>
              <TextInput
                style={styles.modalInput}
                value={editHours}
                onChangeText={setEditHours}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditBranch(null)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                  <Check size={14} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Update</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pageSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  branchList: {
    gap: 14,
  },
  branchCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  branchCity: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  statusSwitchWrap: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
  },
  detailsBox: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    padding: 8,
    gap: 4,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  osmCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignSelf: 'flex-start',
  },
  osmCardBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
  },
  controlsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
    paddingTop: 8,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSubtle,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  controlSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 8,
  },
  stepBtn: {
    padding: 4,
  },
  stepVal: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    minWidth: 46,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.textMain },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.textMain,
  },
  cityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  cityPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  cityPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cityPillText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  cityPillTextActive: { color: '#FFFFFF' },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: Colors.bgSubtle,
  },
  cancelBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 4,
  },
  saveBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});
