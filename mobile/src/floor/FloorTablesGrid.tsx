import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Table, TableStatus } from '../types';
import { Utensils, Key, RefreshCw, X, UserCheck, LayoutGrid, AlertCircle, CheckCircle, Plus, Calendar, ChevronLeft } from 'lucide-react-native';

interface FloorTablesGridProps {
  onOpenWalkIn: (tableNumber: string) => void;
  onNavigateToQueue?: () => void;
  onBack?: () => void;
}

export function FloorTablesGrid({ onOpenWalkIn, onNavigateToQueue, onBack }: FloorTablesGridProps) {
  const {
    tables,
    orders,
    currentUser,
    updateTableStatus,
    updateTable,
    generateTablePin,
    markOrderDeliveredToTable,
    markOrderDoneAndCollected,
    showToast,
    setBottomSheetOpen,
  } = useApp();

  const assignedFloor = currentUser?.assignedFloor || 'Ground Floor';
  const assignedTableNums = useMemo(() => currentUser?.assignedTableNumbers || [], [currentUser?.assignedTableNumbers]);
  const hasAssignedStation = assignedTableNums.length > 0;

  const [selectedFloor, setSelectedFloor] = useState<string>('All Floors');
  const [activeTab, setActiveTab] = useState<'grid' | 'reservations'>('grid');
  const [viewScope, setViewScope] = useState<'assigned' | 'all'>(hasAssignedStation ? 'assigned' : 'all');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  useEffect(() => {
    if (!selectedTable) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [selectedTable, setBottomSheetOpen]);

  const FLOORS = ['All Floors', 'Ground Floor', '1st Floor Family Lounge', 'Rooftop Terrace'];

  // All tables on selected floor
  const allFloorTables = useMemo(() => {
    if (selectedFloor === 'All Floors') return tables;
    return tables.filter((t) => (t.floor || 'Ground Floor') === selectedFloor);
  }, [tables, selectedFloor]);

  // Tables assigned specifically to current floor staff
  const myAssignedTables = useMemo(() => {
    return allFloorTables.filter(
      (t) =>
        assignedTableNums.includes(t.number) ||
        t.assignedWaiterId === currentUser?.id ||
        (currentUser?.name && t.assignedWaiterName === currentUser.name)
    );
  }, [allFloorTables, assignedTableNums, currentUser?.id, currentUser?.name]);

  // Total count of all assigned tables across the cafe for this user
  const totalMyAssignedCount = useMemo(() => {
    return tables.filter(
      (t) =>
        assignedTableNums.includes(t.number) ||
        t.assignedWaiterId === currentUser?.id ||
        (currentUser?.name && t.assignedWaiterName === currentUser.name)
    ).length;
  }, [tables, assignedTableNums, currentUser?.id, currentUser?.name]);

  // Filtered list based on viewScope
  const displayedTables = viewScope === 'assigned' ? myAssignedTables : allFloorTables;

  // Active Dine-In order occupying the selected table
  const activeOrderForSelectedTable = useMemo(() => {
    if (!selectedTable) return null;
    return orders.find(
      (o) =>
        o.type === 'dine_in' &&
        (String(o.tableNumber) === String(selectedTable.number) ||
          String(o.tableNumber) === String(selectedTable.id)) &&
        (o.status === 'ready' ||
          o.status === 'served' ||
          o.status === 'preparing' ||
          o.status === 'accepted' ||
          o.status === 'placed')
    );
  }, [orders, selectedTable]);

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return { bg: Colors.successLight, text: Colors.success, border: Colors.successBorder };
      case 'occupied':
        return { bg: Colors.dangerLight, text: Colors.danger, border: Colors.dangerBorder };
      case 'reserved':
        return { bg: Colors.warningLight, text: Colors.warning, border: Colors.warningBorder };
      case 'cleaning':
        return { bg: Colors.infoLight, text: Colors.info, border: Colors.infoBorder };
      default:
        return { bg: Colors.bgSubtle, text: Colors.textMuted, border: Colors.borderColor };
    }
  };

  const handleSetStatus = (newStatus: TableStatus) => {
    if (!selectedTable) return;
    updateTableStatus(selectedTable.id, newStatus);
    setSelectedTable((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  const handleGeneratePin = () => {
    if (!selectedTable) return;
    const pin = generateTablePin(selectedTable.id);
    setSelectedTable((prev) => (prev ? { ...prev, pin } : null));
  };

  const handleClaimTable = () => {
    if (!selectedTable || !currentUser) return;
    updateTable(selectedTable.id, {
      assignedWaiterId: currentUser.id,
      assignedWaiterName: currentUser.name,
    });
    setSelectedTable((prev) =>
      prev
        ? {
            ...prev,
            assignedWaiterId: currentUser.id,
            assignedWaiterName: currentUser.name,
          }
        : null
    );
    showToast(`Table ${selectedTable.number} claimed by you`, 'success');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingVertical: 4 }}
        >
          <ChevronLeft size={20} color={Colors.primary} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>Back to Overview</Text>
        </TouchableOpacity>
      )}
      {/* Top Header + Walk-in Order Button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Floor Staff Tables</Text>
          <Text style={[styles.pageSub, { marginBottom: 0 }]}>
            Floor management & table station assignment • Seating & PIN generator
          </Text>
        </View>
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: Colors.primary,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 8,
          }}
          onPress={() => onOpenWalkIn('T-01')}
          activeOpacity={0.8}
        >
          <Plus size={14} color="#FFFFFF" />
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>+ Walk-in Order</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-Tabs: Live Table Grid vs Reservations List (v1.1) */}
      <View style={styles.scopeRow}>
        <TouchableOpacity
          style={[styles.scopePill, activeTab === 'grid' && styles.scopePillActive]}
          onPress={() => setActiveTab('grid')}
          activeOpacity={0.8}
        >
          <LayoutGrid size={13} color={activeTab === 'grid' ? Colors.textWhite : Colors.textMuted} />
          <Text style={[styles.scopePillText, activeTab === 'grid' && styles.scopePillTextActive]}>
            Live Table Grid
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.scopePill, activeTab === 'reservations' && styles.scopePillActive]}
          onPress={() => setActiveTab('reservations')}
          activeOpacity={0.8}
        >
          <Calendar size={13} color={activeTab === 'reservations' ? Colors.textWhite : Colors.textMuted} />
          <Text style={[styles.scopePillText, activeTab === 'reservations' && styles.scopePillTextActive]}>
            Reservations List
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'reservations' ? (
        <View style={{ gap: 10, marginTop: 4 }}>
          {[
            { id: 'res-1', guest: 'Mrs. Fatima Malik', table: 'T-02', time: '8:30 PM Tonight', party: '4 Guests', status: 'confirmed' },
            { id: 'res-2', guest: 'Dr. Arshad Beg', table: 'T-06', time: '9:00 PM Tonight', party: '8 Guests', status: 'requested' },
          ].map((res) => (
            <View
              key={res.id}
              style={{
                backgroundColor: Colors.bgCard,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: Colors.borderColor,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.textMain }}>{res.guest}</Text>
                <Text style={{ fontSize: 11.5, color: Colors.textMuted, marginTop: 2 }}>
                  Table {res.table} • {res.time} • {res.party}
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: Colors.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
                onPress={() => {
                  const matched = tables.find((t) => t.number === res.table);
                  if (matched) {
                    updateTableStatus(matched.id, 'occupied');
                  }
                  showToast(`${res.guest} seated at Table ${res.table} ✓`, 'success');
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' }}>Seat Guests</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <>
      {/* Scope Selector: My Assigned Tables vs All Tables */}
      <View style={styles.scopeRow}>
        <TouchableOpacity
          style={[styles.scopePill, viewScope === 'assigned' && styles.scopePillActive]}
          onPress={() => setViewScope('assigned')}
          activeOpacity={0.8}
        >
          <UserCheck
            size={13}
            color={viewScope === 'assigned' ? Colors.textWhite : Colors.textMuted}
          />
          <Text
            style={[styles.scopePillText, viewScope === 'assigned' && styles.scopePillTextActive]}
          >
            My Assigned Tables ({myAssignedTables.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.scopePill, viewScope === 'all' && styles.scopePillActive]}
          onPress={() => setViewScope('all')}
          activeOpacity={0.8}
        >
          <LayoutGrid
            size={13}
            color={viewScope === 'all' ? Colors.textWhite : Colors.textMuted}
          />
          <Text style={[styles.scopePillText, viewScope === 'all' && styles.scopePillTextActive]}>
            All Floor Tables ({allFloorTables.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Floor Switcher Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.floorsScroll}
      >
        {FLOORS.map((flr) => {
          const isActive = selectedFloor === flr;
          const isUserAssignedFloor = currentUser?.assignedFloor === flr;
          return (
            <TouchableOpacity
              key={flr}
              style={[
                styles.floorPill,
                isActive && styles.floorPillActive,
                isUserAssignedFloor && !isActive && styles.floorPillStation,
              ]}
              onPress={() => setSelectedFloor(flr)}
            >
              <Text
                style={[
                  styles.floorPillText,
                  isActive && styles.floorPillTextActive,
                  isUserAssignedFloor && !isActive && styles.floorPillStationText,
                ]}
              >
                {flr} {isUserAssignedFloor ? '★' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Empty State for Assigned Tables */}
      {viewScope === 'assigned' && displayedTables.length === 0 ? (
        <View style={styles.emptyBox}>
          <AlertCircle size={36} color={Colors.warning} />
          <Text style={styles.emptyTitle}>No Tables Assigned on this Floor</Text>
          <Text style={styles.emptySub}>
            {hasAssignedStation
              ? `You are currently assigned tables on ${currentUser?.assignedFloor || 'another floor'} (${assignedTableNums.join(', ')}). Switch floor or tap "All Floor Tables" to inspect.`
              : 'Customer Support or Branch Manager can assign you specific tables from the management desk.'}
          </Text>
          <TouchableOpacity
            style={styles.switchScopeBtn}
            onPress={() => setViewScope('all')}
          >
            <Text style={styles.switchScopeBtnText}>View All Tables on {selectedFloor} →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Tables Grid */
        <View style={styles.tablesGrid}>
          {displayedTables.map((table) => {
            const sc = getStatusColor(table.status);
            const isAssignedToMe =
              assignedTableNums.includes(table.number) ||
              table.assignedWaiterId === currentUser?.id;

            return (
              <TouchableOpacity
                key={table.id}
                style={[
                  styles.tableCard,
                  { borderColor: isAssignedToMe ? Colors.primary : sc.border },
                  isAssignedToMe && styles.tableCardAssigned,
                ]}
                onPress={() => setSelectedTable(table)}
                activeOpacity={0.8}
              >
                {/* Assigned indicator badge */}
                {isAssignedToMe ? (
                  <View style={styles.assignedBadge}>
                    <Text style={styles.assignedBadgeText}>★ Assigned to You</Text>
                  </View>
                ) : table.assignedWaiterName ? (
                  <View style={styles.assignedOtherBadge}>
                    <Text style={styles.assignedOtherBadgeText} numberOfLines={1}>
                      {table.assignedWaiterName.split(' ')[0]}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: sc.text }]}>
                    {table.status.toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.tableNumber}>{table.number}</Text>
                <Text style={styles.tableCapacity}>{table.capacity} Chairs</Text>

                {table.pin && (
                  <View style={styles.pinPill}>
                    <Key size={10} color={Colors.primary} />
                    <Text style={styles.pinPillText}>PIN: {table.pin}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
        </>
      )}

      {/* Table Detail & Action Modal */}
      <Modal visible={!!selectedTable} transparent animationType="slide" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTableTitle}>Table {selectedTable?.number}</Text>
                <Text style={styles.modalTableFloor}>
                  {selectedTable?.floor} • {selectedTable?.capacity} Chairs
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTable(null)}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Waiter Station Info */}
            <View style={styles.waiterInfoBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.waiterInfoLabel}>Assigned Service Waiter:</Text>
                <Text style={styles.waiterInfoName}>
                  {selectedTable?.assignedWaiterName || 'Not yet assigned by Customer Support'}
                </Text>
              </View>
              {selectedTable?.assignedWaiterId !== currentUser?.id && (
                <TouchableOpacity style={styles.claimBtn} onPress={handleClaimTable}>
                  <UserCheck size={12} color={Colors.textWhite} />
                  <Text style={styles.claimBtnText}>Claim Table</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Current PIN */}
            <View style={styles.pinBox}>
              <View>
                <Text style={styles.pinLabel}>Active Table 4-Digit QR PIN:</Text>
                <Text style={styles.pinValue}>{selectedTable?.pin || 'Not Set'}</Text>
              </View>
              <TouchableOpacity style={styles.genPinBtn} onPress={handleGeneratePin}>
                <RefreshCw size={12} color={Colors.primary} />
                <Text style={styles.genPinText}>Generate PIN</Text>
              </TouchableOpacity>
            </View>

            {/* Active Table Order (If Seated / Active) */}
            {activeOrderForSelectedTable ? (
              <View style={styles.activeOrderBox}>
                <View style={styles.activeOrderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeOrderTitle}>
                      Order #{activeOrderForSelectedTable.orderNumber}
                    </Text>
                    <Text style={styles.activeOrderGuest}>
                      Guest: {activeOrderForSelectedTable.customerName} • {activeOrderForSelectedTable.paymentMethod}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.orderStatusBadge,
                      {
                        backgroundColor:
                          activeOrderForSelectedTable.status === 'ready'
                            ? Colors.successLight
                            : activeOrderForSelectedTable.status === 'served'
                            ? '#EDE9FE'
                            : Colors.warningLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderStatusBadgeText,
                        {
                          color:
                            activeOrderForSelectedTable.status === 'ready'
                              ? Colors.success
                              : activeOrderForSelectedTable.status === 'served'
                              ? '#7C3AED'
                              : Colors.warning,
                        },
                      ]}
                    >
                      {activeOrderForSelectedTable.status === 'ready'
                        ? 'FOOD READY'
                        : activeOrderForSelectedTable.status === 'served'
                        ? 'GUESTS DINING'
                        : 'COOKING'}
                    </Text>
                  </View>
                </View>

                {/* Items */}
                <View style={styles.orderItemsList}>
                  {activeOrderForSelectedTable.items.map((it, idx) => (
                    <Text key={idx} style={styles.orderItemLine}>
                      • {it.quantity}x {it.name}
                    </Text>
                  ))}
                </View>

                <View style={styles.orderBillRow}>
                  <Text style={styles.orderTotalText}>Total: Rs. {activeOrderForSelectedTable.total}</Text>
                  <Text
                    style={[
                      styles.orderPayStatusText,
                      {
                        color:
                          activeOrderForSelectedTable.paymentStatus === 'paid'
                            ? Colors.success
                            : Colors.warning,
                      },
                    ]}
                  >
                    {activeOrderForSelectedTable.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                  </Text>
                </View>

                {/* Order Action Buttons */}
                <View style={styles.orderActionsRow}>
                  {activeOrderForSelectedTable.status === 'ready' && (
                    <TouchableOpacity
                      style={styles.orderDeliverBtn}
                      onPress={() => {
                        markOrderDeliveredToTable(activeOrderForSelectedTable.id);
                        showToast(`Order delivered to Table ${selectedTable?.number} ✓`, 'success');
                      }}
                      activeOpacity={0.8}
                    >
                      <CheckCircle size={14} color="#FFFFFF" />
                      <Text style={styles.orderDeliverBtnText}>Deliver Food 🍽️</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.orderDoneBtn}
                    onPress={() => {
                      markOrderDoneAndCollected(activeOrderForSelectedTable.id, true);
                      setSelectedTable(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <CheckCircle size={14} color="#FFFFFF" />
                    <Text style={styles.orderDoneBtnText}>Done & Collected (Free Table) ✓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : selectedTable?.status === 'occupied' ? (
              <View style={styles.occupiedAlertBox}>
                <Text style={styles.occupiedAlertText}>
                  Table is marked Occupied. When guests leave, click below to free table:
                </Text>
                <TouchableOpacity
                  style={styles.freeTableBtn}
                  onPress={() => {
                    handleSetStatus('available');
                    showToast(`Table ${selectedTable?.number} marked Available ✓`, 'success');
                  }}
                  activeOpacity={0.8}
                >
                  <CheckCircle size={14} color="#FFFFFF" />
                  <Text style={styles.freeTableBtnText}>Free Table (Mark Available) 🟢</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Status Change Buttons */}
            <Text style={styles.actionsLabel}>Change Table Status:</Text>
            <View style={styles.statusButtonsRow}>
              {(['available', 'occupied', 'cleaning', 'reserved'] as TableStatus[]).map((st) => {
                const sc = getStatusColor(st);
                const isCurrent = selectedTable?.status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.statusToggleBtn,
                      { backgroundColor: sc.bg, borderColor: isCurrent ? sc.text : 'transparent' },
                    ]}
                    onPress={() => handleSetStatus(st)}
                  >
                    <Text style={[styles.statusToggleText, { color: sc.text }]}>
                      {st.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Walk-in Order Button */}
            <TouchableOpacity
              style={styles.walkInBtn}
              onPress={() => {
                const tblNum = selectedTable?.number || 'T-01';
                setSelectedTable(null);
                onOpenWalkIn(tblNum);
              }}
            >
              <Utensils size={15} color={Colors.textWhite} />
              <Text style={styles.walkInBtnText}>
                + New Walk-in Order (Table {selectedTable?.number})
              </Text>
            </TouchableOpacity>

            {onNavigateToQueue && (
              <TouchableOpacity
                style={styles.switchQueueBtn}
                onPress={() => {
                  setSelectedTable(null);
                  onNavigateToQueue();
                }}
              >
                <LayoutGrid size={14} color={Colors.primary} />
                <Text style={styles.switchQueueBtnText}>Go to Waiter Orders Queue</Text>
              </TouchableOpacity>
            )}
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
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pageSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  stationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  stationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  stationSub: {
    fontSize: 10.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stationBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stationBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scopePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    gap: 6,
  },
  scopePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  scopePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  scopePillTextActive: {
    color: Colors.textWhite,
  },
  floorsScroll: {
    gap: 8,
    marginBottom: 14,
  },
  floorPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  floorPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  floorPillStation: {
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primaryLight,
  },
  floorPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  floorPillTextActive: {
    color: Colors.textWhite,
  },
  floorPillStationText: {
    color: Colors.primary,
  },
  emptyBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  switchScopeBtn: {
    marginTop: 14,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  switchScopeBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tableCard: {
    width: '48%',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    elevation: 2,
    position: 'relative',
  },
  tableCardAssigned: {
    backgroundColor: '#FFFDFB',
    borderWidth: 2,
  },
  assignedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 2,
  },
  assignedBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.textWhite,
  },
  assignedOtherBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 70,
  },
  assignedOtherBadgeText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 14,
    marginBottom: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tableNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textMain,
  },
  tableCapacity: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  pinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    marginTop: 8,
  },
  pinPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  modalTableTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
  },
  modalTableFloor: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  waiterInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  waiterInfoLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  waiterInfoName: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 2,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  claimBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  pinBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    marginBottom: 16,
  },
  pinLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  pinValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 2,
    marginTop: 2,
  },
  genPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  genPinText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 8,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  statusToggleText: {
    fontSize: 9,
    fontWeight: '800',
  },
  walkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  walkInBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  activeOrderBox: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    marginBottom: 16,
  },
  activeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeOrderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.textMain,
  },
  activeOrderGuest: {
    fontSize: 10.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  orderItemsList: {
    backgroundColor: Colors.bgCard,
    borderRadius: 8,
    padding: 8,
    gap: 2,
    marginBottom: 8,
  },
  orderItemLine: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMain,
  },
  orderBillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderTotalText: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.primary,
  },
  orderPayStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  orderActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  orderDeliverBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 6,
  },
  orderDeliverBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  orderDoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 6,
  },
  orderDoneBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  occupiedAlertBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: 16,
    gap: 8,
  },
  occupiedAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    lineHeight: 15,
  },
  freeTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  freeTableBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  switchQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
    marginTop: 8,
  },
  switchQueueBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
});
