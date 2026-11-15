import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { MenuItem } from '../types';
import { resolveDishImage } from '../services/api';
import { SheetImportModal } from '../components/SheetImportModal';
import {
  Utensils,
  Edit3,
  X,
  Check,
  Plus,
  Trash2,
  Search,
  Building2,
  Sliders,
  DollarSign,
  Tag,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react-native';

const CATEGORIES = [
  'All',
  'Biryani & Rice',
  'Karahi & Handi',
  'BBQ & Kebabs',
  'Burgers & Fast Food',
  'Tandoor & Breads',
  'Beverages & Desserts',
];

const IMAGE_PRESETS = [
  { label: 'Biryani', url: '/food-biryani.jpg' },
  { label: 'Burger', url: '/food-burger.jpg' },
  { label: 'Pizza', url: '/food-pizza.jpg' },
  { label: 'Rolls', url: '/food-rolls.jpg' },
  { label: 'Dessert', url: '/food-dessert.jpg' },
  { label: 'Chai / Drink', url: '/food-karak-chai.jpg' },
];

export function OwnerMenu() {
  const {
    menuItems,
    categories,
    branches,
    role,
    currentBranch,
    createMenuItem,
    deleteMenuItem,
    updateMenuItemStock,
    updateMenuItemPrice,
    updateMenuItemBranchPrice,
    toggleMenuItemBranchAvailability,
    showToast,
    setBottomSheetOpen,
  } = useApp();

  const allCategoryFilterList = useMemo(() => {
    const list = [...CATEGORIES];
    categories.forEach((c) => {
      if (c && c.trim() && !list.includes(c.trim())) list.push(c.trim());
    });
    menuItems.forEach((m) => {
      if (m.category && m.category.trim() && !list.includes(m.category.trim())) list.push(m.category.trim());
    });
    return list;
  }, [categories, menuItems]);

  const isManager = role === 'branch_manager' || role === 'cashier';
  const isCashier = role === 'cashier';
  const isOwner = role === 'platform_owner';

  // Branch Scope State:
  // - Branch Manager is strictly locked to their own branch
  // - Platform Owner can toggle between 'all' (global catalog) and individual branches
  const [selectedBranchScope, setSelectedBranchScope] = useState<string>(isManager ? currentBranch.id : 'all');
  const activeBranchId = isManager ? currentBranch.id : selectedBranchScope;
  const isGlobalScope = !isManager && selectedBranchScope === 'all';

  const activeBranchName = useMemo(() => {
    if (isGlobalScope) return 'All Branches';
    const b = branches.find((br) => br.id === activeBranchId);
    return b ? b.name : currentBranch.name;
  }, [isGlobalScope, branches, activeBranchId, currentBranch.name]);

  const [selectedCat, setSelectedCat] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [newPriceText, setNewPriceText] = useState<string>('');

  const [branchPriceModalItem, setBranchPriceModalItem] = useState<MenuItem | null>(null);
  const [branchPriceInputs, setBranchPriceInputs] = useState<Record<string, string>>({});

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<MenuItem | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sheetImportOpen, setSheetImportOpen] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishCategory, setNewDishCategory] = useState(CATEGORIES[1]);
  const [newDishPrice, setNewDishPrice] = useState('500');
  const [newDishDesc, setNewDishDesc] = useState('');
  const [newDishImage, setNewDishImage] = useState('/food-biryani.jpg');

  useEffect(() => {
    const isModalOpen = Boolean(addModalOpen || editingItem || branchPriceModalItem || deleteConfirmItem);
    if (!isModalOpen) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [addModalOpen, editingItem, branchPriceModalItem, deleteConfirmItem, setBottomSheetOpen]);

  // Filtered menu
  const filteredDishes = useMemo(() => {
    return menuItems.filter((dish) => {
      const matchCat =
        selectedCat === 'All' ||
        (dish.category || '').toLowerCase() === selectedCat.toLowerCase();
      const matchSearch =
        searchQuery.trim() === '' ||
        dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dish.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedCat, searchQuery]);

  // Save Price: Global Base Price if in All Branches mode, or Branch Override Price if in Branch Scope mode
  const handleSavePrice = () => {
    if (!editingItem) return;
    const priceNum = parseInt(newPriceText, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Please enter a valid price in PKR', 'danger');
      return;
    }
    if (isGlobalScope) {
      updateMenuItemPrice(editingItem.id, priceNum);
    } else {
      updateMenuItemBranchPrice(editingItem.id, activeBranchId, priceNum);
    }
    setEditingItem(null);
  };

  // Open Branch Prices Modal (Owner only)
  const handleOpenBranchPrices = (dish: MenuItem) => {
    setBranchPriceModalItem(dish);
    const initialInputs: Record<string, string> = {};
    branches.forEach((b) => {
      const currentOverride = dish.branchPriceOverrides?.[b.id];
      initialInputs[b.id] = currentOverride ? currentOverride.toString() : dish.basePrice.toString();
    });
    setBranchPriceInputs(initialInputs);
  };

  // Save Branch Specific Prices
  const handleSaveBranchPrices = () => {
    if (!branchPriceModalItem) return;
    branches.forEach((b) => {
      const val = parseInt(branchPriceInputs[b.id] || '', 10);
      if (!isNaN(val) && val > 0) {
        updateMenuItemBranchPrice(branchPriceModalItem.id, b.id, val);
      }
    });
    setBranchPriceModalItem(null);
  };

  // Create New Dish (Owner only)
  const handleCreateDish = async () => {
    if (!newDishName.trim()) {
      showToast('Please enter a dish name', 'warning');
      return;
    }
    const priceNum = parseInt(newDishPrice, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Please enter a valid base price', 'warning');
      return;
    }

    const created = await createMenuItem({
      name: newDishName.trim(),
      category: newDishCategory,
      basePrice: priceNum,
      description: newDishDesc.trim() || undefined,
      image: newDishImage,
      isAvailable: true,
      branchAvailability: {
        'gulberg-lahore': true,
        'f7-islamabad': true,
        'clifton-karachi': true,
      },
      branchPriceOverrides: {},
    });

    if (created) {
      setAddModalOpen(false);
      setNewDishName('');
      setNewDishDesc('');
      setNewDishPrice('500');
    }
  };

  // Delete Dish (Owner only)
  const handleDeleteDish = async () => {
    if (!deleteConfirmItem) return;
    await deleteMenuItem(deleteConfirmItem.id);
    setDeleteConfirmItem(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header & Add / Import Buttons */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>
            {isManager ? `${currentBranch.name.split(' ')[0]} Menu & Stock` : 'Menu & Master Prices'}
          </Text>
          <Text style={styles.pageSub}>
            {isCashier
              ? `Cashier live stock & pricing view for ${currentBranch.name}`
              : isManager
              ? `Authorized branch pricing & stock control for ${currentBranch.name}`
              : 'Enterprise master catalog • Real-time stock • Regional pricing'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {(isOwner || isManager) && (
            <TouchableOpacity
              style={[
                styles.addBtn,
                {
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1.5,
                  borderColor: Colors.primary,
                },
              ]}
              onPress={() => setSheetImportOpen(true)}
            >
              <FileSpreadsheet size={15} color={Colors.primary} />
              <Text style={[styles.addBtnText, { color: Colors.primary }]}>Import Sheet</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalOpen(true)}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>+ Add Dish</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Scope Selector: Owner can pick Global or specific branch; Manager is locked to branch */}
      {isOwner ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branchTabs}>
          <TouchableOpacity
            style={[styles.branchTab, isGlobalScope && styles.branchTabActive]}
            onPress={() => setSelectedBranchScope('all')}
          >
            <Text style={[styles.branchTabText, isGlobalScope && styles.branchTabTextActive]}>
              🌐 All Branches (Global Catalog)
            </Text>
          </TouchableOpacity>
          {branches.map((b) => {
            const isTabActive = selectedBranchScope === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.branchTab, isTabActive && styles.branchTabActive]}
                onPress={() => setSelectedBranchScope(b.id)}
              >
                <Text style={[styles.branchTabText, isTabActive && styles.branchTabTextActive]}>
                  📍 {b.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.managerScopeBanner}>
          <Building2 size={15} color={Colors.primary} />
          <Text style={styles.managerScopeText}>
            {isCashier ? 'Cashier Branch View' : 'Branch Pricing Mode'}: Viewing & managing dishes exclusively for <Text style={{ fontWeight: '900' }}>{currentBranch.name}</Text>.
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search dishes or ingredients..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScroll}
      >
        {allCategoryFilterList.map((cat) => {
          const isActive = selectedCat === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catPill, isActive && styles.catPillActive]}
              onPress={() => setSelectedCat(cat)}
            >
              <Text style={[styles.catPillText, isActive && styles.catPillTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Dishes List */}
      <View style={styles.menuList}>
        {filteredDishes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Utensils size={36} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No dishes found</Text>
            <Text style={styles.emptySub}>Try searching for another dish or add a new recipe.</Text>
          </View>
        ) : (
          filteredDishes.map((dish) => {
            const effectivePrice = isGlobalScope
              ? dish.basePrice
              : (dish.branchPriceOverrides?.[activeBranchId] ?? dish.basePrice);

            const effectiveStock = isGlobalScope
              ? dish.isAvailable
              : (dish.branchAvailability?.[activeBranchId] !== false && dish.isAvailable !== false);

            return (
              <View key={dish.id} style={styles.dishCard}>
                <Image
                  source={{ uri: resolveDishImage(dish.image, dish.category, dish.id) }}
                  style={styles.dishImg as any}
                  resizeMode="cover"
                />
                <View style={styles.dishInfo}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.dishCat}>{(dish.category || 'DISH').toUpperCase()}</Text>
                    {isOwner && (
                      <TouchableOpacity
                        style={styles.deleteIconBtn}
                        onPress={() => setDeleteConfirmItem(dish)}
                      >
                        <Trash2 size={13} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.dishName}>{dish.name}</Text>
                  {dish.description ? (
                    <Text style={styles.dishDesc} numberOfLines={2}>
                      {dish.description}
                    </Text>
                  ) : null}

                  <Text style={styles.dishPrice}>
                    {isGlobalScope ? 'Base Price' : `${activeBranchName.split(' ')[0]} Price`}: Rs. {effectivePrice}
                  </Text>

                  {/* Action Row */}
                  <View style={styles.actionRow}>
                    {/* Stock Toggle */}
                    <View style={styles.stockToggle}>
                      <Text
                        style={[
                          styles.stockLabel,
                          { color: effectiveStock ? Colors.success : Colors.danger },
                        ]}
                      >
                        {effectiveStock ? 'In Stock' : 'Out of Stock'}
                      </Text>
                      <Switch
                        value={effectiveStock}
                        onValueChange={(val) => {
                          if (isGlobalScope) {
                            updateMenuItemStock(dish.id, val);
                          } else {
                            toggleMenuItemBranchAvailability(dish.id, activeBranchId);
                          }
                        }}
                        trackColor={{ false: Colors.dangerLight, true: Colors.successLight }}
                        thumbColor={effectiveStock ? Colors.success : Colors.danger}
                      />
                    </View>

                    <View style={styles.btnGroup}>
                      {/* Edit Price */}
                      <TouchableOpacity
                        style={styles.editPriceBtn}
                        onPress={() => {
                          setEditingItem(dish);
                          setNewPriceText(effectivePrice.toString());
                        }}
                      >
                        <Edit3 size={11} color={Colors.primary} />
                        <Text style={styles.editPriceText}>
                          {isGlobalScope ? 'Base Price' : 'Branch Price'}
                        </Text>
                      </TouchableOpacity>

                      {/* Branch Overrides Modal (Owner Global Mode Only) */}
                      {isOwner && isGlobalScope && (
                        <TouchableOpacity
                          style={styles.branchPriceBtn}
                          onPress={() => handleOpenBranchPrices(dish)}
                        >
                          <Building2 size={11} color={Colors.info} />
                          <Text style={styles.branchPriceText}>Branches</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* MODAL 1: ADD NEW DISH */}
      <Modal visible={addModalOpen} transparent animationType="slide" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Dish to Catalog</Text>
                <TouchableOpacity onPress={() => setAddModalOpen(false)}>
                  <X size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Dish Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={newDishName}
                onChangeText={setNewDishName}
                placeholder="e.g. Royal Peshawari Karahi"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.inputLabel}>Category *</Text>
              <View style={styles.categoryPickerRow}>
                {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.categoryOptionPill,
                      newDishCategory === c && styles.categoryOptionPillActive,
                    ]}
                    onPress={() => setNewDishCategory(c)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        newDishCategory === c && styles.categoryOptionTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Base Price in PKR *</Text>
              <TextInput
                style={styles.modalInput}
                value={newDishPrice}
                onChangeText={setNewDishPrice}
                keyboardType="numeric"
                placeholder="e.g. 850"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.inputLabel}>Description & Ingredients</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 60, textAlignVertical: 'top' }]}
                value={newDishDesc}
                onChangeText={setNewDishDesc}
                placeholder="e.g. Tender chicken wok-tossed with aromatic spices, fresh ginger and green chilies."
                placeholderTextColor={Colors.textMuted}
                multiline
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>Dish Photo</Text>
                {newDishImage ? (
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: Colors.primary }}>
                    Photo Selected
                  </Text>
                ) : (
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: Colors.textMuted }}>
                    No Photo
                  </Text>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}>
                <View style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderColor, backgroundColor: '#FFFFFF', overflow: 'visible' }}>
                  {newDishImage ? (
                    <>
                      <Image
                        source={{ uri: resolveDishImage(newDishImage, newDishCategory, 'new') }}
                        style={{ width: '100%', height: '100%', borderRadius: 9 }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={() => setNewDishImage('')}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: Colors.danger,
                          borderWidth: 1.5,
                          borderColor: '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={11} color="#FFFFFF" strokeWidth={3} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSubtle, borderRadius: 9 }}>
                      <Utensils size={18} color={Colors.textMuted} />
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 4 }}>
                    {newDishImage ? 'Picture selected. Tap ✕ to remove or switch preset:' : 'No picture. Pick a preset below:'}
                  </Text>
                  <View style={styles.presetsRow}>
                    {IMAGE_PRESETS.map((p) => (
                      <TouchableOpacity
                        key={p.url}
                        style={[
                          styles.presetBadge,
                          newDishImage === p.url && styles.presetBadgeActive,
                        ]}
                        onPress={() => setNewDishImage(p.url)}
                      >
                        <Text
                          style={[
                            styles.presetBadgeText,
                            newDishImage === p.url && styles.presetBadgeTextActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setAddModalOpen(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleCreateDish}>
                  <Check size={14} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Publish Dish</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: EDIT BASE PRICE */}
      <Modal visible={!!editingItem} transparent animationType="fade" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Master Price</Text>
              <TouchableOpacity onPress={() => setEditingItem(null)}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.editingDishName}>{editingItem?.name}</Text>
            <Text style={styles.modalDesc}>
              Updating this price changes the master base price across customer storefront and web ordering.
            </Text>

            <Text style={styles.inputLabel}>New Base Price (PKR)</Text>
            <TextInput
              style={styles.modalInput}
              value={newPriceText}
              onChangeText={setNewPriceText}
              keyboardType="numeric"
              placeholder="e.g. 950"
              placeholderTextColor={Colors.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingItem(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSavePrice}>
                <Check size={14} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Save Price</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: BRANCH PRICING & AVAILABILITY */}
      <Modal visible={!!branchPriceModalItem} transparent animationType="slide" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Branch Pricing & Stock</Text>
                  <Text style={styles.editingDishName}>{branchPriceModalItem?.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setBranchPriceModalItem(null)}>
                  <X size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDesc}>
                Set branch-specific price overrides and toggle dish availability per city branch.
              </Text>

              {branches.map((b) => {
                const isBranchAvail =
                  branchPriceModalItem?.branchAvailability?.[b.id] !== false;

                return (
                  <View key={b.id} style={styles.branchPriceCard}>
                    <View style={styles.branchPriceHeader}>
                      <View>
                        <Text style={styles.branchNameText}>{b.name}</Text>
                        <Text style={styles.branchCityText}>{b.city}</Text>
                      </View>
                      <View style={styles.branchAvailToggle}>
                        <Text
                          style={[
                            styles.branchAvailLabel,
                            { color: isBranchAvail ? Colors.success : Colors.danger },
                          ]}
                        >
                          {isBranchAvail ? 'Available' : 'Disabled'}
                        </Text>
                        <Switch
                          value={isBranchAvail}
                          onValueChange={() => {
                            if (branchPriceModalItem) {
                              toggleMenuItemBranchAvailability(branchPriceModalItem.id, b.id);
                            }
                          }}
                          trackColor={{ false: Colors.dangerLight, true: Colors.successLight }}
                          thumbColor={isBranchAvail ? Colors.success : Colors.danger}
                        />
                      </View>
                    </View>

                    <Text style={styles.branchInputLabel}>Branch Override Price (PKR):</Text>
                    <TextInput
                      style={styles.branchPriceInput}
                      value={branchPriceInputs[b.id] || ''}
                      onChangeText={(t) =>
                        setBranchPriceInputs((prev) => ({ ...prev, [b.id]: t }))
                      }
                      keyboardType="numeric"
                      placeholder={`Default: Rs. ${branchPriceModalItem?.basePrice}`}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                );
              })}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setBranchPriceModalItem(null)}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBranchPrices}>
                  <Check size={14} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Branch Overrides</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: DELETE CONFIRMATION */}
      <Modal visible={!!deleteConfirmItem} transparent animationType="fade" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.deleteModalHeader}>
              <AlertTriangle size={24} color="#DC2626" />
              <Text style={styles.modalTitle}>Delete Dish from Menu?</Text>
            </View>

            <Text style={styles.modalMsg}>
              Are you sure you want to permanently remove "{deleteConfirmItem?.name}" from the Foodies Cafe menu across all branches?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeleteConfirmItem(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#DC2626' }]}
                onPress={handleDeleteDish}
              >
                <Trash2 size={14} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Yes, Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 5: EXCEL / SHEET IMPORT FOR MANAGER & OWNER */}
      <SheetImportModal
        visible={sheetImportOpen}
        onClose={() => setSheetImportOpen(false)}
        activeBranchScope={activeBranchId}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageTitle: { fontSize: 18, fontWeight: '800', color: Colors.textMain },
  pageSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  branchTabs: {
    gap: 6,
    marginBottom: 12,
  },
  branchTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  branchTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  branchTabText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  branchTabTextActive: { color: '#FFFFFF', fontWeight: '800' },
  managerScopeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight + '40',
    borderWidth: 1,
    borderColor: Colors.primary + '50',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  managerScopeText: { fontSize: 11.5, color: Colors.textMain, flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.textMain },
  categoriesScroll: { gap: 6, marginBottom: 14 },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  catPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catPillText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  catPillTextActive: { color: '#FFFFFF', fontWeight: '800' },
  menuList: { gap: 12 },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textMain, marginTop: 10 },
  emptySub: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  dishCard: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    gap: 12,
  },
  dishImg: { width: 75, height: 75, borderRadius: 10 },
  dishInfo: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dishCat: { fontSize: 9, fontWeight: '700', color: Colors.primary },
  deleteIconBtn: { padding: 4 },
  dishName: { fontSize: 13, fontWeight: '800', color: Colors.textMain, marginTop: 1 },
  dishDesc: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  dishPrice: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginTop: 3 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
  },
  stockToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockLabel: { fontSize: 10, fontWeight: '800' },
  btnGroup: { flexDirection: 'row', gap: 6 },
  editPriceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  editPriceText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  branchPriceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  branchPriceText: { fontSize: 10, fontWeight: '700', color: Colors.info },
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.textMain },
  editingDishName: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  modalDesc: { fontSize: 11, color: Colors.textMuted, lineHeight: 15, marginBottom: 12 },
  modalMsg: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMain, marginBottom: 4, marginTop: 8 },
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
  categoryPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  categoryOptionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  categoryOptionPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryOptionText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  categoryOptionTextActive: { color: '#FFFFFF' },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  presetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  presetBadgeActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  presetBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  presetBadgeTextActive: { color: Colors.primary },
  branchPriceCard: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  branchPriceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  branchNameText: { fontSize: 12, fontWeight: '800', color: Colors.textMain },
  branchCityText: { fontSize: 10, color: Colors.textMuted },
  branchAvailToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  branchAvailLabel: { fontSize: 10, fontWeight: '700' },
  branchInputLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginBottom: 2 },
  branchPriceInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
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
