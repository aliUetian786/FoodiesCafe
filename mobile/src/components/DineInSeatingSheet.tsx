import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { normalizeBranchId } from '../services/api';
import { Utensils, X, Users, CheckCircle2 } from 'lucide-react-native';

const { height } = Dimensions.get('window');

interface DineInSeatingSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirmTable: (tableNumber: string) => void;
  initialTable?: string;
}

export function DineInSeatingSheet({
  visible,
  onClose,
  onConfirmTable,
  initialTable = 'T-01',
}: DineInSeatingSheetProps) {
  const { tables, currentBranch, showToast, setBottomSheetOpen } = useApp();

  useEffect(() => {
    if (!visible) return;
    setBottomSheetOpen(true);
    return () => {
      setBottomSheetOpen(false);
    };
  }, [visible, setBottomSheetOpen]);

  // Filter tables for current branch with normalization
  const normBranchId = normalizeBranchId(currentBranch.id);
  const branchTables = useMemo(() => {
    return tables.filter(
      (t) => !t.branchId || t.branchId === currentBranch.id || normalizeBranchId(t.branchId) === normBranchId
    );
  }, [tables, currentBranch.id, normBranchId]);

  // Extract distinct floors
  const floors = useMemo(() => {
    const set = new Set<string>();
    branchTables.forEach((t) => {
      if (t.floor) set.add(t.floor);
    });
    const list = Array.from(set);
    return list.length > 0 ? list : ['Ground Floor'];
  }, [branchTables]);

  const [activeFloor, setActiveFloor] = useState<string>(floors[0] || 'Ground Floor');

  // Available free tables for the active floor
  const floorAvailableTables = useMemo(() => {
    return branchTables.filter(
      (t) => (t.floor || 'Ground Floor') === activeFloor && t.status === 'available'
    );
  }, [branchTables, activeFloor]);

  const [selectedTable, setSelectedTable] = useState<string>(initialTable);

  // Set default selection if none chosen
  React.useEffect(() => {
    if (floorAvailableTables.length > 0 && !floorAvailableTables.some((t) => t.number === selectedTable)) {
      setSelectedTable(floorAvailableTables[0].number);
    }
  }, [floorAvailableTables, selectedTable]);

  const totalAvailable = branchTables.filter((t) => t.status === 'available').length;

  const handleConfirm = () => {
    if (!selectedTable) {
      showToast('Please select a table to continue', 'danger');
      return;
    }
    onConfirmTable(selectedTable);
    showToast(`Table ${selectedTable} reserved for Dine-In`, 'success');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent={true} navigationBarTranslucent={true}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        {/* Half screen bottom sheet from bottom to middle of screen */}
        <View style={styles.sheetContainer}>
          {/* Drag Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Utensils size={16} color={Colors.primary} />
                <Text style={styles.title}>Select Table & Seating</Text>
              </View>
              <Text style={styles.subtitle}>
                {totalAvailable} available tables at {currentBranch.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Floor Selection Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.floorsScrollContent}
            style={styles.floorsScroll}
          >
            {floors.map((fl) => {
              const isActive = activeFloor === fl;
              const count = branchTables.filter(
                (t) => (t.floor || 'Ground Floor') === fl && t.status === 'available'
              ).length;

              return (
                <TouchableOpacity
                  key={fl}
                  style={[styles.floorPill, isActive && styles.floorPillActive]}
                  onPress={() => setActiveFloor(fl)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.floorPillText, isActive && styles.floorPillTextActive]}>
                    {fl} ({count} Free)
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Tables Grid */}
          <ScrollView
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.tablesGridContent}
            style={styles.tablesScroll}
          >
            {floorAvailableTables.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No available tables on this floor right now</Text>
              </View>
            ) : (
              <View style={styles.tablesGrid}>
                {floorAvailableTables.map((t) => {
                  const isSelected = selectedTable === t.number;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.tableCard, isSelected && styles.tableCardSelected]}
                      onPress={() => setSelectedTable(t.number)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.tableTopRow}>
                        <Text style={[styles.tableNum, isSelected && styles.tableNumSelected]}>
                          {t.number}
                        </Text>
                        {isSelected && <CheckCircle2 size={14} color={Colors.primary} />}
                      </View>
                      <View style={styles.capacityRow}>
                        <Users size={11} color={isSelected ? Colors.primary : Colors.textMuted} />
                        <Text
                          style={[
                            styles.capacityText,
                            isSelected && styles.capacityTextSelected,
                          ]}
                        >
                          {t.capacity || 4} Seats
                        </Text>
                      </View>
                      <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' }} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A' }}>
                          Available
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Confirm Action Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.88}
            >
              <Text style={styles.confirmBtnText}>
                Confirm Table {selectedTable} & Proceed to Payment ➔
              </Text>
            </TouchableOpacity>
          </View>
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
    height: height * 0.52, // Half screen from bottom to middle of screen
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  handleWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 3,
    backgroundColor: Colors.borderColor,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgMain,
  },
  floorsScroll: {
    maxHeight: 36,
    marginVertical: 10,
  },
  floorsScrollContent: {
    gap: 8,
  },
  floorPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bgMain,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  floorPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryBorder,
  },
  floorPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  floorPillTextActive: {
    color: Colors.primary,
  },
  tablesScroll: {
    flex: 1,
  },
  tablesGridContent: {
    paddingBottom: 10,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tableCard: {
    width: '31%',
    backgroundColor: Colors.bgCard,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  tableCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF7F2',
  },
  tableTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  tableNum: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  tableNumSelected: {
    color: Colors.primary,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  capacityText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  capacityTextSelected: {
    color: Colors.primary,
  },
  emptyWrap: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '800',
  },
});
