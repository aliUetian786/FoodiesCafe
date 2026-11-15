import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { CartItem } from '../types';
import { Utensils, Plus, Minus, Check, ArrowLeft, Trash2 } from 'lucide-react-native';

interface FloorWalkInOrderProps {
  initialTableNumber?: string;
  onOrderDispatched: () => void;
  onBack: () => void;
}

export function FloorWalkInOrder({
  initialTableNumber = 'T-01',
  onOrderDispatched,
  onBack,
}: FloorWalkInOrderProps) {
  const { tables, menuItems, placeFloorWalkInOrder, showToast } = useApp();

  const [selectedTableNum, setSelectedTableNum] = useState<string>(initialTableNumber);
  const [customerName, setCustomerName] = useState<string>('Walk-in Guest');
  const [orderItems, setOrderItems] = useState<{ [id: string]: number }>({});

  const availableTables = tables.filter((t) => t.status === 'available' || t.number === selectedTableNum);

  const handleAddDish = (dishId: string) => {
    setOrderItems((prev) => ({
      ...prev,
      [dishId]: (prev[dishId] || 0) + 1,
    }));
  };

  const handleRemoveDish = (dishId: string) => {
    setOrderItems((prev) => {
      const current = prev[dishId] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[dishId];
        return copy;
      }
      return { ...prev, [dishId]: current - 1 };
    });
  };

  const totalBill = Object.entries(orderItems).reduce((sum, [id, qty]) => {
    const dish = menuItems.find((m) => m.id === id);
    return sum + (dish?.basePrice || 0) * qty;
  }, 0);

  const handleDispatch = () => {
    if (Object.keys(orderItems).length === 0) {
      showToast('Please add at least 1 dish to walk-in order', 'warning');
      return;
    }

    const cartList: CartItem[] = Object.entries(orderItems).map(([id, qty]) => {
      const dish = menuItems.find((m) => m.id === id)!;
      return {
        id: `walkin-${Date.now()}-${id}`,
        menuItemId: dish.id,
        name: dish.name,
        unitPrice: dish.basePrice,
        quantity: qty,
      };
    });

    placeFloorWalkInOrder(selectedTableNum, cartList, customerName);
    onOrderDispatched();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={18} color={Colors.textMain} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Walk-in Table Order</Text>
          <Text style={styles.subtitle}>Direct Kitchen Queue Dispatch (No hold timers)</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Table Selector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Select Table for Seating:</Text>
          <View style={styles.tablesRow}>
            {availableTables.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.tablePill,
                  selectedTableNum === t.number && styles.tablePillActive,
                ]}
                onPress={() => setSelectedTableNum(t.number)}
              >
                <Text
                  style={[
                    styles.tablePillText,
                    selectedTableNum === t.number && styles.tablePillTextActive,
                  ]}
                >
                  {t.number} ({t.floor.split(' ')[0]})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Guest Name / Group Tag:</Text>
          <TextInput
            style={styles.textInput}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="e.g. Walk-in Family of 4"
          />
        </View>

        {/* Dishes Selector */}
        <View style={styles.dishesSection}>
          <Text style={styles.sectionLabel}>Select Dishes from Menu:</Text>
          {menuItems.map((dish) => {
            const qty = orderItems[dish.id] || 0;
            return (
              <View key={dish.id} style={styles.dishRow}>
                <Image source={{ uri: dish.image }} style={styles.dishImg} />
                <View style={styles.dishInfo}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  <Text style={styles.dishPrice}>Rs. {dish.basePrice}</Text>
                </View>

                {qty > 0 ? (
                  <View style={styles.stepperBox}>
                    <TouchableOpacity onPress={() => handleRemoveDish(dish.id)}>
                      <Minus size={13} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperQty}>{qty}</Text>
                    <TouchableOpacity onPress={() => handleAddDish(dish.id)}>
                      <Plus size={13} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addBtn} onPress={() => handleAddDish(dish.id)}>
                    <Plus size={13} color={Colors.textWhite} />
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Bottom Dispatch Bar */}
      {totalBill > 0 && (
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomTable}>Table {selectedTableNum}</Text>
            <Text style={styles.bottomBill}>Total: Rs. {totalBill}</Text>
          </View>
          <TouchableOpacity style={styles.dispatchBtn} onPress={handleDispatch}>
            <Check size={16} color={Colors.textWhite} />
            <Text style={styles.dispatchBtnText}>Dispatch to Kitchen ➔</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 90,
  },
  sectionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 8,
  },
  tablesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tablePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
  },
  tablePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tablePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  tablePillTextActive: {
    color: Colors.textWhite,
  },
  textInput: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.textMain,
  },
  dishesSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSubtle,
    gap: 10,
  },
  dishImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  dishInfo: {
    flex: 1,
  },
  dishName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  dishPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 8,
  },
  stepperQty: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 8,
  },
  bottomTable: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  bottomBill: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
  },
  dispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  dispatchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
});

