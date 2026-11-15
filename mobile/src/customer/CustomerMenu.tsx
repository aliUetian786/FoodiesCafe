import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { MenuItem, OrderType } from '../types';
import { resolveDishImage, getItemMinPrice } from '../services/api';
import { Search, Plus, Minus, Trash2, X, ShoppingBag, Utensils, Bike } from 'lucide-react-native';
import { CustomerLoginModal } from './CustomerLoginModal';
import { AllBranchesClosedModal } from '../components/AllBranchesClosedModal';

const { width } = Dimensions.get('window');

interface CustomerMenuProps {
  onOpenCheckout: () => void;
}

export function CustomerMenu({ onOpenCheckout }: CustomerMenuProps) {
  const {
    menuItems,
    branches,
    categories,
    cart,
    addToCart,
    updateCartQty,
    cartCount,
    cartSubtotal,
    isCustomerLoggedIn,
    currentBranch,
    hasSelectedBranch,
    setBranchUnavailableModal,
    orderType,
    setOrderType,
    hasConfirmedOrderType,
    setHasConfirmedOrderType,
    showToast,
    setBottomSheetOpen,
  } = useApp();

  const isDelivery = orderType === 'delivery';
  const minDeliveryAmount = currentBranch?.minDeliveryAmount ?? 500;
  const isBelowMinDelivery = isDelivery && cartCount > 0 && cartSubtotal < minDeliveryAmount;
  const deliveryShortfall = Math.max(0, minDeliveryAmount - cartSubtotal);

  const allBranchesClosed = branches.length > 0 && branches.every((b) => !b.isOpen);
  const [closedCheckoutModalVisible, setClosedCheckoutModalVisible] = useState(false);
  const [orderTypeModalVisible, setOrderTypeModalVisible] = useState(false);

  const handleProceedCheckoutPress = () => {
    if (allBranchesClosed) {
      setClosedCheckoutModalVisible(true);
      return;
    }
    // 1. If not logged in first, prompt login first
    if (!isCustomerLoggedIn) {
      setLoginModalVisible(true);
      return;
    }
    // 2. Selection of order type appears after clicking checkout button
    setOrderTypeModalVisible(true);
  };

  const handleSelectOrderType = (type: OrderType) => {
    setOrderType(type);
    setHasConfirmedOrderType(true);
    setOrderTypeModalVisible(false);

    // If delivery is chosen and cart subtotal is less than minimum delivery amount:
    // Do NOT proceed to checkout. Show toast and display notice above checkout button.
    if (type === 'delivery' && cartSubtotal < minDeliveryAmount) {
      showToast(
        `Min delivery order is Rs. ${minDeliveryAmount}. Select Rs. ${deliveryShortfall} more items to cross this value for delivery.`,
        'warning'
      );
      return;
    }

    // Auto proceed to checkout page showing selected items
    onOpenCheckout();
  };

  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] || 'Biryani & Rice');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDishForModal, setSelectedDishForModal] = useState<MenuItem | null>(null);
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  useEffect(() => {
    const isAnyModalActive = Boolean(
      selectedDishForModal ||
      orderTypeModalVisible ||
      loginModalVisible ||
      closedCheckoutModalVisible
    );
    if (!isAnyModalActive) return;
    setBottomSheetOpen(true);
    return () => {
      setBottomSheetOpen(false);
    };
  }, [
    selectedDishForModal,
    orderTypeModalVisible,
    loginModalVisible,
    closedCheckoutModalVisible,
    setBottomSheetOpen,
  ]);

  // Customizer Modal state
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [instructions, setInstructions] = useState<string>('');

  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const categoryScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const categoryOffsets = useRef<Record<string, number>>({});
  const pillOffsets = useRef<Record<string, number>>({});
  const isManualScrolling = useRef<boolean>(false);

  const filteredDishes = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return menuItems.filter((dish) => {
      const q = searchQuery.toLowerCase();
      return dish.name.toLowerCase().includes(q) || dish.description.toLowerCase().includes(q);
    });
  }, [menuItems, searchQuery]);

  const openCustomizer = (dish: MenuItem) => {
    setSelectedDishForModal(dish);
    setSelectedSize(dish.sizes?.[0]?.name);
    setSelectedExtras([]);
    setInstructions('');
  };

  const handleConfirmAddModal = (e?: any) => {
    if (!selectedDishForModal) return;
    const coords = e?.nativeEvent ? { startX: e.nativeEvent.pageX, startY: e.nativeEvent.pageY } : undefined;
    addToCart(selectedDishForModal, selectedSize, selectedExtras, instructions, coords);
    setSelectedDishForModal(null);
  };

  const toggleExtra = (extraName: string) => {
    setSelectedExtras((prev) =>
      prev.includes(extraName) ? prev.filter((e) => e !== extraName) : [...prev, extraName]
    );
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    const targetX = pillOffsets.current[cat];
    if (typeof targetX === 'number') {
      categoryScrollRef.current?.scrollTo({ x: Math.max(0, targetX - 40), animated: true });
    }
    const targetY = categoryOffsets.current[cat] ?? 0;
    isManualScrolling.current = true;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 8), animated: true });
    setTimeout(() => {
      isManualScrolling.current = false;
    }, 600);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isManualScrolling.current || searchQuery.trim().length > 0) return;
    const scrollY = event.nativeEvent.contentOffset.y;

    let activeCat = categories[0];
    for (const cat of categories) {
      const offset = categoryOffsets.current[cat] ?? 0;
      if (scrollY >= offset - 60) {
        activeCat = cat;
      }
    }
    if (activeCat && activeCat !== selectedCategory) {
      setSelectedCategory(activeCat);
      const targetX = pillOffsets.current[activeCat];
      if (typeof targetX === 'number') {
        categoryScrollRef.current?.scrollTo({ x: Math.max(0, targetX - 40), animated: true });
      }
    }
  };

  const renderDishCard = (dish: MenuItem) => {
    const cartItemsForDish = cart.filter((ci) => ci.menuItemId === dish.id);
    const totalQtyInCart = cartItemsForDish.reduce((sum, ci) => sum + ci.quantity, 0);

    const isAvailAtBranch = hasSelectedBranch
      ? (dish.branchAvailability?.[currentBranch.id] !== false && dish.isAvailable !== false)
      : (dish.isAvailable !== false);
    const branchPrice = hasSelectedBranch
      ? (dish.branchPriceOverrides?.[currentBranch.id] ?? dish.basePrice)
      : getItemMinPrice(dish);

    return (
      <View key={dish.id} style={[styles.dishCard, !isAvailAtBranch && { opacity: 0.85, borderColor: '#FCA5A5' }]}>
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: resolveDishImage(dish.image, dish.category, dish.id) }}
            style={styles.dishImage}
            resizeMode="cover"
          />
          {!isAvailAtBranch && (
            <View style={styles.branchUnavailableBadge}>
              <Text style={styles.branchUnavailableBadgeText}>UNAVAILABLE HERE</Text>
            </View>
          )}
        </View>
        <View style={styles.dishDetails}>
          <Text style={styles.dishCatName}>{dish.category.toUpperCase()}</Text>
          <Text style={styles.dishTitle} numberOfLines={1}>
            {dish.name}
          </Text>
          <Text style={styles.dishDescription} numberOfLines={2}>
            {dish.description}
          </Text>

          <View style={styles.dishActionRow}>
            <Text style={styles.dishPriceText}>Rs. {branchPrice}</Text>

            {/* Stepper or Add button */}
            {!isAvailAtBranch ? (
              <TouchableOpacity
                style={styles.unavailableBtn}
                onPress={() => {
                  setBranchUnavailableModal({
                    visible: true,
                    branchName: currentBranch.name,
                    itemNames: [dish.name],
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.unavailableBtnText}>Unavailable</Text>
              </TouchableOpacity>
            ) : totalQtyInCart > 0 ? (
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => {
                    const firstItem = cartItemsForDish[0];
                    if (firstItem) updateCartQty(firstItem.id, -1);
                  }}
                >
                  {totalQtyInCart === 1 ? (
                    <Trash2 size={13} color={Colors.danger} />
                  ) : (
                    <Minus size={13} color={Colors.primary} />
                  )}
                </TouchableOpacity>
                <Text style={styles.stepperQtyText}>{totalQtyInCart}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={(e) => {
                    const firstItem = cartItemsForDish[0];
                    if (firstItem) updateCartQty(firstItem.id, 1);
                    else {
                      const coords = { startX: e.nativeEvent?.pageX || 200, startY: e.nativeEvent?.pageY || 400 };
                      addToCart(dish, undefined, undefined, undefined, coords);
                    }
                  }}
                >
                  <Plus size={13} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.orderAddBtn}
                onPress={(e) => {
                  if ((dish.sizes && dish.sizes.length > 0) || (dish.extras && dish.extras.length > 0)) {
                    openCustomizer(dish);
                  } else {
                    const coords = { startX: e.nativeEvent?.pageX || 200, startY: e.nativeEvent?.pageY || 400 };
                    addToCart(dish, undefined, undefined, undefined, coords);
                  }
                }}
              >
                <Plus size={13} color={Colors.textWhite} />
                <Text style={styles.orderAddText}>Order</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            placeholder="Search dishes, burgers, biryani..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Sticky Category Tabs */}
      <View style={styles.categoryBarWrap}>
        <ScrollView
          ref={categoryScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onLayout={(e) => {
                  pillOffsets.current[cat] = e.nativeEvent.layout.x;
                }}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => handleSelectCategory(cat)}
                activeOpacity={0.75}
              >
                <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Dishes Scrollable View */}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.dishesList}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* If searching: show filtered results */}
        {filteredDishes !== null ? (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleText}>Search Results</Text>
              <Text style={styles.sectionCountText}>{filteredDishes.length} items found</Text>
            </View>
            {filteredDishes.length === 0 ? (
              <View style={styles.emptySearchWrap}>
                <Text style={styles.emptySearchText}>No dishes found matching "{searchQuery}"</Text>
              </View>
            ) : (
              <View style={styles.dishesGrid}>
                {filteredDishes.map((dish) => renderDishCard(dish))}
              </View>
            )}
          </View>
        ) : (
          /* Normal mode: Show all categories in sequence with live sticky scroll detection */
          categories.map((cat) => {
            const dishesInCat = menuItems.filter((d) => d.category === cat);
            if (dishesInCat.length === 0) return null;

            return (
              <View
                key={cat}
                onLayout={(e) => {
                  categoryOffsets.current[cat] = e.nativeEvent.layout.y;
                }}
                style={styles.categorySection}
              >
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitleText}>{cat}</Text>
                  <Text style={styles.sectionCountText}>{dishesInCat.length} items</Text>
                </View>
                <View style={styles.dishesGrid}>
                  {dishesInCat.map((dish) => renderDishCard(dish))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Bottom Checkout Container */}
      {cartCount > 0 && (
        <View style={styles.floatingCheckoutContainer}>
          {isBelowMinDelivery && (
            <View style={styles.minDeliveryWarningBanner}>
              <View style={styles.minDeliveryWarningIcon}>
                <Bike size={13} color="#DC2626" />
              </View>
              <Text style={styles.minDeliveryWarningText}>
                Min delivery is <Text style={{ fontWeight: '800' }}>Rs. {minDeliveryAmount}</Text>. Select{' '}
                <Text style={{ fontWeight: '900', color: '#DC2626' }}>Rs. {deliveryShortfall}</Text> more to checkout.
              </Text>
            </View>
          )}

          <View style={styles.bottomCheckoutBar}>
            <View style={styles.bottomBarLeft}>
              <View style={styles.cartIconCircle}>
                <ShoppingBag size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.bottomItemCount}>{cartCount} Item(s) Selected</Text>
                <Text style={styles.bottomSubtotal}>Rs. {cartSubtotal}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.proceedCheckoutBtn,
                isBelowMinDelivery && styles.proceedCheckoutBtnDisabled,
              ]}
              onPress={handleProceedCheckoutPress}
              activeOpacity={isBelowMinDelivery ? 0.9 : 0.85}
            >
              <Text style={[styles.proceedCheckoutText, isBelowMinDelivery && styles.proceedCheckoutTextDisabled]}>
                {isBelowMinDelivery ? `Add Rs. ${deliveryShortfall} ➔` : 'Checkout ➔'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Customer Email & Phone OTP Login Modal */}
      <CustomerLoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
        onSuccess={() => {
          setLoginModalVisible(false);
          if (allBranchesClosed) {
            setClosedCheckoutModalVisible(true);
            return;
          }
          setOrderTypeModalVisible(true);
        }}
      />

      {/* All Branches Closed Checkout Block Modal */}
      <AllBranchesClosedModal
        visible={closedCheckoutModalVisible}
        onClose={() => setClosedCheckoutModalVisible(false)}
        branches={branches}
        context="checkout_blocked"
      />

      {/* 3 Clickable Buttons Pop-up Modal Asking for Order Type */}
      <Modal
        visible={orderTypeModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setOrderTypeModalVisible(false)}
      >
        <View style={styles.orderTypeModalBackdrop}>
          <View style={styles.orderTypeModalCard}>
            {/* Modal Header */}
            <View style={styles.orderTypeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderTypeTitle}>🍽️ Select Order Type</Text>
                <Text style={styles.orderTypeSub}>
                  How would you like to receive your food? Select an option to proceed to checkout.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOrderTypeModalVisible(false)}
                style={styles.orderTypeCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* 3 Clickable Buttons */}
            <View style={styles.orderTypeButtonsList}>
              {/* Button 1: Dine-In */}
              <TouchableOpacity
                style={styles.orderTypeOptionCard}
                onPress={() => handleSelectOrderType('dine_in')}
                activeOpacity={0.78}
              >
                <View style={styles.orderTypeIconWrap}>
                  <Utensils size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.orderTypeOptionTitleRow}>
                    <Text style={styles.orderTypeOptionTitle}>Dine-In</Text>
                    <View style={[styles.orderTypePill, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.orderTypePillText, { color: '#92400E' }]}>Table Service</Text>
                    </View>
                  </View>
                  <Text style={styles.orderTypeOptionDesc}>
                    Food served fresh directly to your branch table
                  </Text>
                </View>
                <View style={styles.orderTypeSelectBtn}>
                  <Text style={styles.orderTypeSelectBtnText}>Select ➔</Text>
                </View>
              </TouchableOpacity>

              {/* Button 2: Takeaway */}
              <TouchableOpacity
                style={styles.orderTypeOptionCard}
                onPress={() => handleSelectOrderType('takeaway')}
                activeOpacity={0.78}
              >
                <View style={styles.orderTypeIconWrap}>
                  <ShoppingBag size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.orderTypeOptionTitleRow}>
                    <Text style={styles.orderTypeOptionTitle}>Takeaway</Text>
                    <View style={[styles.orderTypePill, { backgroundColor: '#EFF6FF' }]}>
                      <Text style={[styles.orderTypePillText, { color: '#1D4ED8' }]}>Counter Pickup</Text>
                    </View>
                  </View>
                  <Text style={styles.orderTypeOptionDesc}>
                    Packed fresh to collect at the cafe counter
                  </Text>
                </View>
                <View style={styles.orderTypeSelectBtn}>
                  <Text style={styles.orderTypeSelectBtnText}>Select ➔</Text>
                </View>
              </TouchableOpacity>

              {/* Button 3: Delivery */}
              <TouchableOpacity
                style={styles.orderTypeOptionCard}
                onPress={() => handleSelectOrderType('delivery')}
                activeOpacity={0.78}
              >
                <View style={styles.orderTypeIconWrap}>
                  <Bike size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.orderTypeOptionTitleRow}>
                    <Text style={styles.orderTypeOptionTitle}>Delivery</Text>
                    <View style={[styles.orderTypePill, { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.orderTypePillText, { color: '#15803D' }]}>To Doorstep</Text>
                    </View>
                  </View>
                  <Text style={styles.orderTypeOptionDesc}>
                    Delivered to your home or office with live rider GPS
                  </Text>
                </View>
                <View style={styles.orderTypeSelectBtn}>
                  <Text style={styles.orderTypeSelectBtnText}>Select ➔</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dish Customizer Modal */}
      <Modal visible={!!selectedDishForModal} transparent animationType="slide" statusBarTranslucent={true} navigationBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.customizerSheet}>
            <View style={styles.customizerHeader}>
              <View>
                <Text style={styles.customizerTitle}>{selectedDishForModal?.name}</Text>
                <Text style={styles.customizerBasePrice}>
                  Base Price: Rs.{' '}
                  {selectedDishForModal
                    ? hasSelectedBranch
                      ? (selectedDishForModal.branchPriceOverrides?.[currentBranch.id] ?? selectedDishForModal.basePrice)
                      : getItemMinPrice(selectedDishForModal)
                    : 0}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDishForModal(null)} style={styles.closeModalBtn}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              {/* Portion Sizes */}
              {selectedDishForModal?.sizes && selectedDishForModal.sizes.length > 0 && (
                <View style={styles.optionSection}>
                  <Text style={styles.optionSectionTitle}>Portion Size</Text>
                  {selectedDishForModal.sizes.map((s) => (
                    <TouchableOpacity
                      key={s.name}
                      style={[styles.radioRow, selectedSize === s.name && styles.radioRowActive]}
                      onPress={() => setSelectedSize(s.name)}
                    >
                      <Text style={styles.radioLabel}>{s.name}</Text>
                      <Text style={[styles.radioDelta, s.priceDelta < 0 && styles.radioDeltaDiscount]}>
                        {s.priceDelta === 0
                          ? 'Standard'
                          : s.priceDelta < 0
                          ? `- Rs. ${Math.abs(s.priceDelta)}`
                          : `+ Rs. ${s.priceDelta}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Add-on Extras */}
              {selectedDishForModal?.extras && selectedDishForModal.extras.length > 0 && (
                <View style={styles.optionSection}>
                  <Text style={styles.optionSectionTitle}>Add-on Extras</Text>
                  {selectedDishForModal.extras.map((ex) => {
                    const isChecked = selectedExtras.includes(ex.name);
                    return (
                      <TouchableOpacity
                        key={ex.name}
                        style={[styles.checkRow, isChecked && styles.checkRowActive]}
                        onPress={() => toggleExtra(ex.name)}
                      >
                        <Text style={styles.checkLabel}>{ex.name}</Text>
                        <Text style={styles.checkPrice}>
                          {ex.price < 0 ? `- Rs. ${Math.abs(ex.price)}` : `+ Rs. ${ex.price}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Special Instructions */}
              <View style={styles.optionSection}>
                <Text style={styles.optionSectionTitle}>Special Cooking Instructions</Text>
                <TextInput
                  placeholder="e.g. less spicy, extra raita, well-done..."
                  placeholderTextColor={Colors.textMuted}
                  value={instructions}
                  onChangeText={setInstructions}
                  style={styles.instructionInput}
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.addToCartModalBtn} onPress={handleConfirmAddModal}>
                <Text style={styles.addToCartModalText}>+ Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: Colors.bgCard,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSubtle,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMain,
    padding: 0,
  },
  categoryBarWrap: {
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    paddingVertical: 8,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  categoryPillTextActive: {
    color: Colors.textWhite,
  },
  dishesList: {
    padding: 16,
    paddingBottom: 100,
  },
  categorySection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSubtle,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  sectionCountText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  emptySearchWrap: {
    padding: 30,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  dishesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dishCard: {
    width: (width - 44) / 2,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    elevation: 2,
  },
  dishImage: {
    width: '100%',
    height: 110,
  },
  dishDetails: {
    padding: 10,
  },
  dishCatName: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primary,
  },
  dishTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
    marginTop: 2,
  },
  dishDescription: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
    lineHeight: 14,
    height: 28,
  },
  dishActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
  },
  dishPriceText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  orderAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  orderAddText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  branchUnavailableBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  branchUnavailableBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  unavailableBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  unavailableBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  stepperBtn: {
    padding: 4,
  },
  stepperQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    minWidth: 14,
    textAlign: 'center',
  },
  floatingCheckoutContainer: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    gap: 6,
    zIndex: 50,
  },
  bottomCheckoutBar: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  minDeliveryWarningBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  minDeliveryWarningIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minDeliveryWarningText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '600',
    flex: 1,
  },
  proceedCheckoutBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  proceedCheckoutTextDisabled: {
    color: '#9CA3AF',
  },
  bottomBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomItemCount: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  bottomSubtotal: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.primary,
  },
  proceedCheckoutBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  proceedCheckoutText: {
    color: Colors.textWhite,
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  customizerSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  customizerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  customizerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textMain,
  },
  customizerBasePrice: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 6,
  },
  modalBody: {
    padding: 18,
  },
  optionSection: {
    marginBottom: 16,
  },
  optionSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 8,
  },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  radioRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  radioLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  radioDelta: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  radioDeltaDiscount: {
    color: Colors.success,
  },
  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  checkRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  checkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMain,
  },
  checkPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  instructionInput: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    fontSize: 12,
    color: Colors.textMain,
    minHeight: 50,
  },
  modalFooter: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  addToCartModalBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  addToCartModalText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '800',
  },
  orderTypeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  orderTypeModalCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    width: '100%',
    maxWidth: 420,
    padding: 20,
  },
  orderTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderTypeTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
    marginBottom: 4,
  },
  orderTypeSub: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  orderTypeCloseBtn: {
    padding: 4,
    marginLeft: 10,
  },
  orderTypeButtonsList: {
    gap: 12,
  },
  orderTypeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  orderTypeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderTypeOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  orderTypeOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  orderTypePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  orderTypePillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  orderTypeOptionDesc: {
    fontSize: 11.5,
    color: Colors.textMuted,
    lineHeight: 15,
  },
  orderTypeSelectBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  orderTypeSelectBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
});
