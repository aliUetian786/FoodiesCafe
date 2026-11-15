import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { MenuItem, Branch } from '../types';
import { resolveDishImage, getItemMinPrice } from '../services/api';
import { getOsmDirectionsUrl } from '../utils/openStreetMap';
import {
  Flame,
  ArrowRight,
  Sparkles,
  Utensils,
  ShoppingBag,
  Bike,
  Plus,
  Minus,
  Trash2,
  Megaphone,
  Clock,
  MapPin,
  Tag,
  X,
  Check,
  Navigation,
  Compass,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react-native';
import { BranchSelectionSheet } from '../components/BranchSelectionSheet';
import { DeliveryMapModal } from '../components/DeliveryMapModal';
import { AllBranchesClosedModal } from '../components/AllBranchesClosedModal';

const { width } = Dimensions.get('window');

interface CustomerHomeProps {
  onNavigateToMenu: () => void;
}

export function CustomerHome({ onNavigateToMenu }: CustomerHomeProps) {
  const {
    menuItems,
    branches,
    cart,
    addToCart,
    updateCartQty,
    orderType,
    setOrderType,
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    role,
    currentBranch,
    setBranchId,
    hasSelectedBranch,
    orders,
    hasConfirmedOrderType,
    setHasConfirmedOrderType,
    selectedDeliveryAddress,
    setSelectedDeliveryAddress,
    customerCoordinates,
    calculateDistanceKm,
    showToast,
    setBottomSheetOpen,
  } = useApp();

  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  // All Branches Closed Pop-up State on Home Screen
  const allBranchesClosed = branches.length > 0 && branches.every((b) => !b.isOpen);
  const [allClosedPopupVisible, setAllClosedPopupVisible] = useState(false);
  const [dismissedAllClosedPopup, setDismissedAllClosedPopup] = useState(false);

  useEffect(() => {
    if (!allBranchesClosed) {
      setDismissedAllClosedPopup(false);
      setAllClosedPopupVisible(false);
      return;
    }
    if (!dismissedAllClosedPopup) {
      setAllClosedPopupVisible(true);
    }
  }, [allBranchesClosed, dismissedAllClosedPopup]);

  // Modals for 60% branch selection sheet & interactive delivery map
  const [branchSheetVisible, setBranchSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [deliveryMapVisible, setDeliveryMapVisible] = useState(false);

  // Announcement Modal for Owner / Manager
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTag, setNewTag] = useState('HOT DEAL');
  const [newDesc, setNewDesc] = useState('');
  const [newValidity, setNewValidity] = useState('Valid this week');

  useEffect(() => {
    const isAnyOpen = Boolean(modalVisible || allClosedPopupVisible || branchSheetVisible || deliveryMapVisible);
    if (!isAnyOpen) return;
    setBottomSheetOpen(true);
    return () => {
      setBottomSheetOpen(false);
    };
  }, [modalVisible, allClosedPopupVisible, branchSheetVisible, deliveryMapVisible, setBottomSheetOpen]);

  const canManageAnnouncements = role === 'platform_owner' || role === 'branch_manager';

  const BANNERS = [
    {
      title: 'Mutton Dum Biryani Special',
      subtitle: 'Slow cooked in traditional copper degh with fragrant saffron',
      tag: 'CHEF SPECIAL',
      image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60',
    },
    {
      title: 'Shinwari Chicken Karahi',
      subtitle: 'Cooked fresh on order with tomatoes, black pepper & butter',
      tag: 'HOT & SIZZLING',
      image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=60',
    },
    {
      title: 'Signature Smash Burgers',
      subtitle: '100% Prime beef smashed patties with melted mature cheddar',
      tag: 'POPULAR CHOICE',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60',
    },
  ];

  // 2-Second auto sliding hero carousel matching highlight.md rule
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % BANNERS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const activeBanner = BANNERS[activeBannerIndex];

  // Mode Selection: When customer clicks take away or dine in, branch list sheet appears (60-70% screen)
  const handleSelectMode = (mode: 'dine_in' | 'takeaway' | 'delivery') => {
    if (mode === 'delivery') {
      setDeliveryMapVisible(true);
    } else {
      setSheetMode(mode);
      setBranchSheetVisible(true);
    }
  };

  // On Branch Confirmed: Customer stays on Branch Home with saved branch
  const handleBranchSelected = (b: Branch) => {
    setBranchId(b.id);
    setOrderType(sheetMode);
    setHasConfirmedOrderType(true);
    setBranchSheetVisible(false);
    showToast(`${sheetMode === 'dine_in' ? 'Dine-In' : 'Takeaway'} set to ${b.name}`, 'success');
  };

  // On Delivery Address Confirmed: Customer stays on Branch Home with saved branch
  const handleDeliveryConfirmed = (addr: string, branch: Branch) => {
    setBranchId(branch.id);
    setSelectedDeliveryAddress(addr);
    setOrderType('delivery');
    setHasConfirmedOrderType(true);
    setDeliveryMapVisible(false);
    showToast(`Delivery set to ${addr}`, 'success');
  };

  // Calculate distance to current branch
  const branchDistanceKm = calculateDistanceKm(
    customerCoordinates.lat,
    customerCoordinates.lng,
    currentBranch.coordinates?.lat ?? currentBranch.latitude ?? 31.5204,
    currentBranch.coordinates?.lng ?? currentBranch.longitude ?? 74.3587
  );

  // Directions to current branch via OpenStreetMap
  const handleOpenBranchDirections = () => {
    const lat = currentBranch.coordinates?.lat ?? currentBranch.latitude ?? 31.5204;
    const lng = currentBranch.coordinates?.lng ?? currentBranch.longitude ?? 74.3587;
    const url = getOsmDirectionsUrl(
      { lat: customerCoordinates.lat, lng: customerCoordinates.lng },
      { lat, lng }
    );
    Linking.openURL(url).catch(() => {
      showToast(`Location: ${currentBranch.name}`, 'info');
    });
  };

  // Find recent pending order that customer is waiting to receive
  const pendingOrder = orders.find((o) =>
    ['placed', 'accepted', 'preparing', 'ready', 'served', 'out_for_delivery'].includes(o.status)
  );

  // 1-Tap Add to Cart on Signature Specials with flying animation
  const handleAddSignatureDish = (dish: MenuItem, e: any) => {
    const pageX = e?.nativeEvent?.pageX || width / 2;
    const pageY = e?.nativeEvent?.pageY || 400;
    addToCart(dish, undefined, undefined, undefined, { startX: pageX, startY: pageY });
  };

  const handlePostAnnouncement = () => {
    if (!newTitle.trim() || !newDesc.trim()) return;

    addAnnouncement({
      title: newTitle.trim(),
      tag: newTag.trim().toUpperCase(),
      description: newDesc.trim(),
      validUntil: newValidity.trim(),
      branchId: role === 'branch_manager' ? currentBranch.id : undefined,
      branchName: role === 'branch_manager' ? currentBranch.name : 'All Branches',
      badgeColor: newTag.includes('HOT') ? '#EF4444' : '#F59E0B',
    });

    setNewTitle('');
    setNewDesc('');
    setModalVisible(false);
  };

  const handleOrderFoodNav = () => {
    onNavigateToMenu();
  };

  // Filter announcements for current branch or global
  const visibleAnnouncements = announcements.filter(
    (a) => !a.branchId || a.branchId === currentBranch.id
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 3 Compact Inline Mode Selector Cards: Logo & Text in same line */}
        <View style={styles.orderModeRow}>
          {/* Dine-In Card */}
          <TouchableOpacity
            style={[
              styles.orderModeCard,
              orderType === 'dine_in' && styles.orderModeCardActive,
            ]}
            onPress={() => handleSelectMode('dine_in')}
            activeOpacity={0.8}
          >
            <Utensils
              size={15}
              color={orderType === 'dine_in' ? Colors.primary : Colors.textMuted}
            />
            <Text
              style={[
                styles.orderModeTitle,
                orderType === 'dine_in' && styles.orderModeTitleActive,
              ]}
            >
              Dine-In
            </Text>
          </TouchableOpacity>

          {/* Takeaway Card */}
          <TouchableOpacity
            style={[
              styles.orderModeCard,
              orderType === 'takeaway' && styles.orderModeCardActive,
            ]}
            onPress={() => handleSelectMode('takeaway')}
            activeOpacity={0.8}
          >
            <ShoppingBag
              size={15}
              color={orderType === 'takeaway' ? Colors.primary : Colors.textMuted}
            />
            <Text
              style={[
                styles.orderModeTitle,
                orderType === 'takeaway' && styles.orderModeTitleActive,
              ]}
            >
              Takeaway
            </Text>
          </TouchableOpacity>

          {/* Delivery Card */}
          <TouchableOpacity
            style={[
              styles.orderModeCard,
              orderType === 'delivery' && styles.orderModeCardActive,
            ]}
            onPress={() => handleSelectMode('delivery')}
            activeOpacity={0.8}
          >
            <Bike
              size={15}
              color={orderType === 'delivery' ? Colors.primary : Colors.textMuted}
            />
            <Text
              style={[
                styles.orderModeTitle,
                orderType === 'delivery' && styles.orderModeTitleActive,
              ]}
            >
              Delivery
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2-Second Auto-Sliding Hero Carousel */}
        <TouchableOpacity style={styles.heroBanner} onPress={handleOrderFoodNav} activeOpacity={0.9}>
          <Image source={{ uri: activeBanner.image }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.tagBadge}>
              <Sparkles size={11} color={Colors.textWhite} />
              <Text style={styles.tagText}>{activeBanner.tag}</Text>
            </View>
            <Text style={styles.heroTitle}>{activeBanner.title}</Text>
            <Text style={styles.heroSubtitle}>{activeBanner.subtitle}</Text>
            <View style={styles.heroButtonRow}>
              <View style={styles.orderNowButton}>
                <Text style={styles.orderNowText}>Order Now</Text>
                <ArrowRight size={14} color={Colors.textWhite} />
              </View>
            </View>
          </View>

          {/* Carousel dots */}
          <View style={styles.carouselDots}>
            {BANNERS.map((_, idx) => (
              <View
                key={idx}
                style={[styles.dot, idx === activeBannerIndex && styles.activeDot]}
              />
            ))}
          </View>
        </TouchableOpacity>

        {/* Featured Signature Dishes */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Flame size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Signature Specials</Text>
          </View>
          <TouchableOpacity onPress={onNavigateToMenu}>
            <Text style={styles.viewAllText}>View Menu →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dishesGrid}>
          {menuItems.slice(0, 4).map((dish) => {
            const cartItemsForDish = cart.filter((ci) => ci.menuItemId === dish.id);
            const totalQtyInCart = cartItemsForDish.reduce((sum, ci) => sum + ci.quantity, 0);
            const dishPrice = hasSelectedBranch
              ? (dish.branchPriceOverrides?.[currentBranch.id] ?? dish.basePrice)
              : getItemMinPrice(dish);

            return (
              <View key={dish.id} style={styles.dishCard}>
                <Image
                  source={{ uri: resolveDishImage(dish.image, dish.category, dish.id) }}
                  style={styles.dishImage}
                  resizeMode="cover"
                />
                <View style={styles.dishInfo}>
                  <Text style={styles.dishCategory}>{dish.category.toUpperCase()}</Text>
                  <Text style={styles.dishName} numberOfLines={1}>
                    {dish.name}
                  </Text>
                  <Text style={styles.dishDesc} numberOfLines={2}>
                    {dish.description}
                  </Text>
                  <View style={styles.dishPriceRow}>
                    <Text style={styles.dishPrice}>Rs. {dishPrice}</Text>

                    {/* Stepper if in cart, or 1-tap add with flying animation */}
                    {totalQtyInCart > 0 ? (
                      <View style={styles.homeStepperWrap}>
                        <TouchableOpacity
                          style={styles.stepperMiniBtn}
                          onPress={() => {
                            const firstItem = cartItemsForDish[0];
                            if (firstItem) updateCartQty(firstItem.id, -1);
                          }}
                        >
                          {totalQtyInCart === 1 ? (
                            <Trash2 size={11} color={Colors.danger} />
                          ) : (
                            <Minus size={11} color={Colors.primary} />
                          )}
                        </TouchableOpacity>
                        <Text style={styles.stepperMiniText}>{totalQtyInCart}</Text>
                        <TouchableOpacity
                          style={styles.stepperMiniBtn}
                          onPress={(e) => handleAddSignatureDish(dish, e)}
                        >
                          <Plus size={11} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.miniAddBtn}
                        onPress={(e) => handleAddSignatureDish(dish, e)}
                        activeOpacity={0.8}
                      >
                        <Plus size={12} color={Colors.primary} />
                        <Text style={styles.miniAddText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ================= ANNOUNCEMENTS & SPECIAL DEALS NEWS SECTION ================= */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <View style={styles.sectionTitleRow}>
            <Megaphone size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Announcements & Deals</Text>
          </View>
          {canManageAnnouncements && (
            <TouchableOpacity
              style={styles.postDealBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <Plus size={13} color={Colors.textWhite} />
              <Text style={styles.postDealBtnText}>Post Deal</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.announcementsWrap}>
          {visibleAnnouncements.length === 0 ? (
            <View style={styles.emptyAnnounceCard}>
              <Text style={styles.emptyAnnounceText}>No announcements posted right now</Text>
            </View>
          ) : (
            visibleAnnouncements.map((a) => (
              <View key={a.id} style={styles.announcementCard}>
                <View style={styles.announcementTopRow}>
                  <View style={[styles.dealTagBadge, { backgroundColor: a.badgeColor || Colors.primary }]}>
                    <Tag size={10} color={Colors.textWhite} />
                    <Text style={styles.dealTagText}>{a.tag}</Text>
                  </View>
                  <View style={styles.validityWrap}>
                    <Clock size={11} color={Colors.textMuted} />
                    <Text style={styles.validityText}>{a.validUntil || 'Active Offer'}</Text>
                  </View>
                </View>

                <Text style={styles.announcementTitle}>{a.title}</Text>
                <Text style={styles.announcementDesc}>{a.description}</Text>

                <View style={styles.announcementFooter}>
                  <View style={styles.branchScopePill}>
                    <MapPin size={11} color={Colors.primary} />
                    <Text style={styles.branchScopeText}>
                      {a.branchName ? `Branch: ${a.branchName}` : 'All Branches'}
                    </Text>
                  </View>

                  {canManageAnnouncements && (
                    <TouchableOpacity
                      style={styles.deleteAnnounceBtn}
                      onPress={() => deleteAnnouncement(a.id)}
                    >
                      <Trash2 size={13} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating "Order Food" Action Button */}
      <TouchableOpacity
        style={styles.floatingOrderBtn}
        onPress={handleOrderFoodNav}
        activeOpacity={0.85}
      >
        <Flame size={18} color={Colors.textWhite} />
        <Text style={styles.floatingOrderText}>Order Food</Text>
      </TouchableOpacity>

      {/* Modal for Owner / Manager to Post an Announcement */}
      <Modal visible={modalVisible} transparent animationType="slide" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeading}>
                {role === 'branch_manager'
                  ? `Post Deal for ${currentBranch.name.split(' ')[0]}`
                  : 'Post Platform Announcement'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Deal / Announcement Headline</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 20% Off Weekend BBQ & Biryani"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.inputLabel}>Badge Tag (e.g. HOT DEAL, SPECIAL, CHEF DEAL)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="HOT DEAL"
                value={newTag}
                onChangeText={setNewTag}
              />

              <Text style={styles.inputLabel}>Details & Terms</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="Describe the offer, discount or branch news..."
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
              />

              <Text style={styles.inputLabel}>Validity Schedule</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Valid Tonight 02:00 AM, Every Weekend"
                value={newValidity}
                onChangeText={setNewValidity}
              />

              <TouchableOpacity
                style={styles.submitAnnouncementBtn}
                onPress={handlePostAnnouncement}
                activeOpacity={0.85}
              >
                <Check size={16} color={Colors.textWhite} />
                <Text style={styles.submitAnnouncementText}>Publish Announcement</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 60% Screen Height Branch Selection Sheet for Dine-In & Takeaway */}
      <BranchSelectionSheet
        visible={branchSheetVisible}
        onClose={() => setBranchSheetVisible(false)}
        orderMode={sheetMode}
        onBranchSelected={handleBranchSelected}
      />

      {/* Delivery Saved Addresses & Interactive Map Modal */}
      <DeliveryMapModal
        visible={deliveryMapVisible}
        onClose={() => setDeliveryMapVisible(false)}
        onConfirmDelivery={handleDeliveryConfirmed}
      />

      {/* All Branches Closed Pop-up on Home Screen */}
      <AllBranchesClosedModal
        visible={allClosedPopupVisible}
        onClose={() => {
          setDismissedAllClosedPopup(true);
          setAllClosedPopupVisible(false);
        }}
        onBrowseMenu={() => {
          setDismissedAllClosedPopup(true);
          setAllClosedPopupVisible(false);
          onNavigateToMenu();
        }}
        branches={branches}
        context="home"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  orderModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  orderModeCard: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    paddingHorizontal: 8,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    gap: 6,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  orderModeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  orderModeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  orderModeTitleActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  // Branch Home Banner Styles
  branchHomeBanner: {
    backgroundColor: '#FFF7F2',
    borderWidth: 1.2,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  branchHomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  branchHomeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  branchHomeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  changeBranchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FFEDD5',
    borderRadius: 6,
  },
  changeBranchText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  branchHomeAddress: {
    fontSize: 11.5,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  branchHomeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  branchDistancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  branchDistanceText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  branchStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  pillOpen: {
    backgroundColor: '#D1FAE5',
  },
  pillClosed: {
    backgroundColor: '#FEE2E2',
  },
  branchStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusOpenText: {
    color: '#059669',
  },
  statusClosedText: {
    color: '#DC2626',
  },
  branchNavBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  branchNavBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  closureNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  closureNoticeText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1,
  },

  // Active Pending Order in Progress Card
  pendingOrderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#FDBA74',
    padding: 12,
    marginBottom: 16,
    gap: 6,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  pendingOrderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingOrderLeft: {
    flex: 1,
  },
  pendingOrderNum: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pendingOrderTime: {
    fontSize: 10.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  pendingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pendingStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  pendingOrderItems: {
    fontSize: 12,
    color: Colors.textMain,
    lineHeight: 16,
  },
  pendingOrderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    marginTop: 4,
  },
  pendingBranchName: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
  },
  pendingDirectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pendingDirectionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  heroBanner: {
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
    elevation: 3,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 12, 10, 0.52)',
  },
  heroContent: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    bottom: 14,
    justifyContent: 'space-between',
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textWhite,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textWhite,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  heroButtonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  orderNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  orderNowText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  carouselDots: {
    position: 'absolute',
    bottom: 8,
    right: 14,
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeDot: {
    width: 16,
    backgroundColor: Colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  postDealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  postDealBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textWhite,
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
  dishInfo: {
    padding: 10,
  },
  dishCategory: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primary,
  },
  dishName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
    marginTop: 2,
  },
  dishDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
    lineHeight: 14,
    height: 28,
  },
  dishPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
  },
  dishPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  miniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    gap: 3,
  },
  miniAddText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  homeStepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  stepperMiniBtn: {
    padding: 3,
  },
  stepperMiniText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    minWidth: 12,
    textAlign: 'center',
  },
  announcementsWrap: {
    gap: 12,
  },
  emptyAnnounceCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  emptyAnnounceText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  announcementCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  announcementTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dealTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dealTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.textWhite,
    letterSpacing: 0.5,
  },
  validityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  validityText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 4,
  },
  announcementDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: 10,
  },
  announcementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
    paddingTop: 8,
  },
  branchScopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  branchScopeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  deleteAnnounceBtn: {
    padding: 4,
  },
  floatingOrderBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 28,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingOrderText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textWhite,
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    paddingBottom: 10,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  modalBody: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  modalInput: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    fontSize: 12,
    color: Colors.textMain,
  },
  submitAnnouncementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 10,
    gap: 6,
  },
  submitAnnouncementText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '800',
  },
  branchClosedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  branchClosedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  branchClosedSub: {
    fontSize: 10.5,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 14,
  },
  changeBranchMiniBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeBranchMiniText: {
    color: Colors.textWhite,
    fontSize: 10.5,
    fontWeight: '800',
  },
});
