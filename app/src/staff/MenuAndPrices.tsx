'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { MenuItem, HeroBanner, DealCard } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Save,
  Layers,
  Phone,
  MapPin,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  X,
  FileText,
  Sparkles,
  Clock,
  Check,
  ArrowRight,
  Image as ImageIcon,
  Flame,
  Headphones,
  Timer,
} from 'lucide-react';

export const MenuPricesScreen: React.FC = () => {
  const {
    menuItems,
    branches,
    categories,
    addCategory,
    renameCategory,
    deleteCategory,
    updateMenuItem,
    addMenuItem,
    deleteMenuItem,
    allowRepresentativeMenuEdit,
    setAllowRepresentativeMenuEdit,
    footerSettings,
    updateFooterSettings,
    heroBanners,
    dealCard,
    allowRepresentativeDirectPublish,
    setAllowRepresentativeDirectPublish,
    pendingApprovalRequests,
    updateHeroBanner,
    addHeroBanner,
    deleteHeroBanner,
    updateDealCard,
    approveRequest,
    rejectRequest,
    currentRole,
    addToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'items' | 'categories' | 'banners' | 'footer' | 'permissions'>('items');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Permission check: branch managers, platform owners, and branch representatives (the concerned persons) can edit
  const canEdit =
    currentRole === 'branch_manager' ||
    currentRole === 'platform_owner' ||
    currentRole === 'branch_representative' ||
    allowRepresentativeMenuEdit;

  // Item Editor State
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<MenuItem | null>(null);

  // Item Form Fields (All Requirements)
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState(categories[0] || 'Biryani & Rice');
  const [itemPrice, setItemPrice] = useState<number>(500);
  const [itemDesc, setItemDesc] = useState('');
  const [itemImage, setItemImage] = useState('/food-biryani.jpg');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemBranchAvail, setItemBranchAvail] = useState<Record<string, boolean>>({
    'gulberg-lahore': true,
    'f7-islamabad': true,
    'clifton-karachi': true,
  });
  const [itemBranchPrices, setItemBranchPrices] = useState<Record<string, number>>({});

  // Category Editor State
  const [newCatName, setNewCatName] = useState('');
  const [renamingCat, setRenamingCat] = useState<{ oldName: string; newName: string } | null>(null);

  // Footer & Routing Settings State
  const [helpline, setHelpline] = useState(footerSettings.helpline);
  const [email, setEmail] = useState(footerSettings.email);
  const [hours, setHours] = useState(footerSettings.hours);
  const [addrLahore, setAddrLahore] = useState(footerSettings.addressLahore);
  const [addrIslamabad, setAddrIslamabad] = useState(footerSettings.addressIslamabad);
  const [addrKarachi, setAddrKarachi] = useState(footerSettings.addressKarachi);
  const [tagline, setTagline] = useState(footerSettings.tagline);
  const [orderRoutingSupportFirst, setOrderRoutingSupportFirst] = useState(footerSettings.orderRoutingSupportFirst ?? true);
  const [autoForwardMode, setAutoForwardMode] = useState<'manual' | 'timed'>(footerSettings.autoForwardMode ?? 'timed');
  const [autoForwardKitchenMin, setAutoForwardKitchenMin] = useState<number>(footerSettings.autoForwardKitchenMin ?? 3);

  useEffect(() => {
    setHelpline(footerSettings.helpline);
    setEmail(footerSettings.email);
    setHours(footerSettings.hours);
    setAddrLahore(footerSettings.addressLahore);
    setAddrIslamabad(footerSettings.addressIslamabad);
    setAddrKarachi(footerSettings.addressKarachi);
    setTagline(footerSettings.tagline);
    setOrderRoutingSupportFirst(footerSettings.orderRoutingSupportFirst ?? true);
    setAutoForwardMode(footerSettings.autoForwardMode ?? 'timed');
    setAutoForwardKitchenMin(footerSettings.autoForwardKitchenMin ?? 3);
  }, [footerSettings]);

  // Hero Banner Editor State
  const [editingBanner, setEditingBanner] = useState<HeroBanner | null>(null);
  const [isNewBanner, setIsNewBanner] = useState(false);
  const [deleteBannerTarget, setDeleteBannerTarget] = useState<HeroBanner | null>(null);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerBadge, setBannerBadge] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('/hero-bg.jpg');
  const [bannerCategory, setBannerCategory] = useState(categories[0] || 'Biryani & Rice');

  // Chef Deal Card Editor State
  const [dealTitle, setDealTitle] = useState(dealCard.title);
  const [dealSubtitle, setDealSubtitle] = useState(dealCard.subtitle);
  const [dealPrice, setDealPrice] = useState(dealCard.price);
  const [dealTag, setDealTag] = useState(dealCard.tag);
  const [dealImageUrl, setDealImageUrl] = useState(dealCard.imageUrl);
  const [dealCategory, setDealCategory] = useState(dealCard.categoryLink || categories[0] || 'Biryani & Rice');

  const openNewItemModal = () => {
    setIsNewItem(true);
    setEditingItem({
      id: `m-${Date.now()}`,
      name: '',
      category: categories[0] || 'Biryani & Rice',
      description: '',
      basePrice: 500,
      image: '/food-biryani.jpg',
      isAvailable: true,
      branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    });
    setItemName('');
    setItemCategory(categories[0] || 'Biryani & Rice');
    setItemPrice(500);
    setItemDesc('');
    setItemImage('/food-biryani.jpg');
    setItemAvailable(true);
    setItemBranchAvail({ 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true });
    setItemBranchPrices({});
  };

  const openEditItemModal = (item: MenuItem) => {
    setIsNewItem(false);
    setEditingItem(item);
    setItemName(item.name);
    setItemCategory(item.category);
    setItemPrice(item.basePrice);
    setItemDesc(item.description);
    setItemImage(item.image || '/food-biryani.jpg');
    setItemAvailable(item.isAvailable);
    setItemBranchAvail(item.branchAvailability || { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true });
    setItemBranchPrices(item.branchPriceOverrides || {});
  };

  const handleSaveItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !editingItem) return;

    const itemPayload: MenuItem = {
      ...editingItem,
      name: itemName.trim(),
      category: itemCategory,
      basePrice: Number(itemPrice) || 0,
      image: itemImage.trim() || '/food-biryani.jpg',
      description: itemDesc.trim(),
      isAvailable: itemAvailable,
      branchAvailability: itemBranchAvail,
      branchPriceOverrides: itemBranchPrices,
    };

    if (isNewItem) {
      addMenuItem(itemPayload);
      addToast({
        type: 'success',
        title: 'Item Created',
        message: `${itemPayload.name} added to menu successfully.`,
      });
    } else {
      updateMenuItem(itemPayload);
      addToast({
        type: 'success',
        title: 'Item Updated',
        message: `${itemPayload.name} updated successfully.`,
      });
    }

    setEditingItem(null);
  };

  const handleSaveFooterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFooterSettings({
      helpline,
      email,
      hours,
      addressLahore: addrLahore,
      addressIslamabad: addrIslamabad,
      addressKarachi: addrKarachi,
      tagline,
      orderRoutingSupportFirst,
      autoForwardMode,
      autoForwardKitchenMin: Number(autoForwardKitchenMin) || 3,
    });
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory(newCatName.trim());
    setNewCatName('');
  };

  const handleRenameCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingCat || !renamingCat.newName.trim()) return;
    renameCategory(renamingCat.oldName, renamingCat.newName.trim());
    setRenamingCat(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        gap: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Rep permission status banner if in view only mode */}
      {!canEdit && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-cancelled-bg)',
            color: 'var(--status-cancelled-text)',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <AlertCircle size={15} />
          <span>Viewing Mode: Editing requires Branch Manager permission</span>
        </div>
      )}

      {/* Tabs & Actions Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('items')}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeTab === 'items' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'items' ? '#FFFFFF' : 'var(--text-main)',
              border: activeTab === 'items' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <UtensilsCrossed size={16} />
            <span>Menu Items ({menuItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeTab === 'categories' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'categories' ? '#FFFFFF' : 'var(--text-main)',
              border: activeTab === 'categories' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={16} />
            <span>Categories ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('banners')}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeTab === 'banners' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'banners' ? '#FFFFFF' : 'var(--text-main)',
              border: activeTab === 'banners' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Sparkles size={16} />
            <span>Deals</span>
            {pendingApprovalRequests.filter((r) => r.status === 'pending').length > 0 && (
              <span
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-full)',
                  boxShadow: '0 0 8px rgba(220, 38, 38, 0.4)',
                }}
              >
                {pendingApprovalRequests.filter((r) => r.status === 'pending').length} PENDING
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('footer')}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeTab === 'footer' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'footer' ? '#FFFFFF' : 'var(--text-main)',
              border: activeTab === 'footer' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Headphones size={16} />
            <span>Customer Services</span>
          </button>

          {(currentRole === 'branch_manager' || currentRole === 'platform_owner') && (
            <button
              onClick={() => setActiveTab('permissions')}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: activeTab === 'permissions' ? 'var(--primary)' : 'var(--bg-card)',
                color: activeTab === 'permissions' ? '#FFFFFF' : 'var(--text-main)',
                border: activeTab === 'permissions' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={16} />
              <span>Rep Permissions</span>
            </button>
          )}
        </div>

        {/* + Create New Item in line with Customer Services (Support) button */}
        {canEdit && activeTab === 'items' && (
          <button
            onClick={openNewItemModal}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '13.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px var(--primary-glow)',
              border: 'none',
              marginLeft: 'auto',
            }}
          >
            <Plus size={16} />
            <span>+ Create New Menu Item</span>
          </button>
        )}
      </div>

      {/* TAB 1: MENU ITEMS */}
      {activeTab === 'items' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Categories filter bar: static directly below the tabs/header */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: selectedCategoryFilter === 'all' ? 'var(--primary)' : 'var(--bg-card)',
                color: selectedCategoryFilter === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              All Items ({menuItems.length})
            </button>
            {categories.map((cat) => {
              const count = menuItems.filter((i) => i.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: selectedCategoryFilter === cat ? 'var(--primary)' : 'var(--bg-card)',
                    color: selectedCategoryFilter === cat ? '#FFFFFF' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Static Table Container below categories with internal scroll */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-card-subtle)' }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 18px', backgroundColor: 'var(--bg-card-subtle)' }}>Dish / Product</th>
                  <th style={{ padding: '12px 18px', backgroundColor: 'var(--bg-card-subtle)' }}>Category</th>
                  <th style={{ padding: '12px 18px', backgroundColor: 'var(--bg-card-subtle)' }}>Price</th>
                  <th style={{ padding: '12px 18px', backgroundColor: 'var(--bg-card-subtle)' }}>Availability</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right', backgroundColor: 'var(--bg-card-subtle)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {menuItems
                  .filter((item) => selectedCategoryFilter === 'all' || item.category === selectedCategoryFilter)
                  .map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={item.image} alt={item.name} style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.description}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', fontWeight: 600 }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--primary)', fontSize: '15px' }}>
                      Rs. {item.basePrice.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: item.isAvailable ? 'var(--status-ready-bg)' : 'var(--status-cancelled-bg)',
                          color: item.isAvailable ? 'var(--status-ready-text)' : 'var(--status-cancelled-text)',
                        }}
                      >
                        {item.isAvailable ? 'IN STOCK' : 'OUT OF STOCK'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      {canEdit ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditItemModal(item)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--bg-card-subtle)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-main)',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Edit2 size={13} color="var(--primary)" />
                            <span>Edit Item</span>
                          </button>
                          <button
                            onClick={() => setDeleteItemTarget(item)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--status-cancelled-bg)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--status-cancelled-text)',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Read Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORIES */}
      {activeTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
          {/* Categories List */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Current Menu Categories ({categories.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map((cat) => (
                <div
                  key={cat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                    {cat}
                  </span>

                  {canEdit && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setRenamingCat({ oldName: cat, newName: cat })}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => deleteCategory(cat)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--status-cancelled-bg)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--status-cancelled-text)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add / Rename Category Form */}
          {canEdit && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              {renamingCat ? (
                <form onSubmit={handleRenameCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Rename Category: {renamingCat.oldName}
                  </h3>
                  <input
                    type="text"
                    value={renamingCat.newName}
                    onChange={(e) => setRenamingCat({ ...renamingCat, newName: e.target.value })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--primary)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="submit"
                      style={{
                        padding: '10px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Update Category Name
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingCat(null)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAddCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Add New Category
                  </h3>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Seafood & Platters, Chaat & Street Food"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '14px',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={16} />
                    <span>Create Category</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CUSTOMER SERVICES & FOOTER SETTINGS (Manager Editable) */}
      {activeTab === 'footer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
          {/* SECTION 1: CUSTOMER ORDER ROUTING & KITCHEN DISPATCH */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1.5px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                  }}
                >
                  <Headphones size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Customer Order Routing to Customer Services
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Control how newly placed customer orders route to Customer Services before reaching the Kitchen
                  </p>
                </div>
              </div>

              {/* Master Route Toggle */}
              <button
                type="button"
                onClick={() => setOrderRoutingSupportFirst(!orderRoutingSupportFirst)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: orderRoutingSupportFirst ? 'var(--primary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title={orderRoutingSupportFirst ? 'Orders route to Customer Services first' : 'Orders go straight to kitchen'}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: orderRoutingSupportFirst ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {orderRoutingSupportFirst ? 'Route to Support: ACTIVE' : 'Direct to Kitchen: ACTIVE'}
                </span>
                {orderRoutingSupportFirst ? <ToggleRight size={38} /> : <ToggleLeft size={38} />}
              </button>
            </div>

            {orderRoutingSupportFirst ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--bg-card-subtle)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 700 }}>
                  Kitchen Forwarding Rule:
                </div>

                {/* Forwarding Mode Radio Pills */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setAutoForwardMode('timed')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: autoForwardMode === 'timed' ? 'var(--primary)' : 'var(--bg-card)',
                      color: autoForwardMode === 'timed' ? '#FFFFFF' : 'var(--text-main)',
                      border: autoForwardMode === 'timed' ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                      fontSize: '12.5px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Timer size={14} />
                    <span>Auto-Forward to Kitchen after Custom Time</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoForwardMode('manual')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: autoForwardMode === 'manual' ? 'var(--primary)' : 'var(--bg-card)',
                      color: autoForwardMode === 'manual' ? '#FFFFFF' : 'var(--text-main)',
                      border: autoForwardMode === 'manual' ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                      fontSize: '12.5px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle size={14} />
                    <span>Manual Support Verification Only</span>
                  </button>
                </div>

                {/* Timed Configuration Inputs */}
                {autoForwardMode === 'timed' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Set Custom Auto-Forward Time:
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {[1, 2, 3, 5, 10, 15].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setAutoForwardKitchenMin(mins)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: autoForwardKitchenMin === mins ? 'var(--primary)' : 'var(--bg-card)',
                            color: autoForwardKitchenMin === mins ? '#FFFFFF' : 'var(--text-main)',
                            border: autoForwardKitchenMin === mins ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {mins} min{mins > 1 ? 's' : ''}
                        </button>
                      ))}

                      {/* Custom Minutes Input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Custom:</span>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={autoForwardKitchenMin}
                          onChange={(e) => setAutoForwardKitchenMin(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{
                            width: '65px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>min(s)</span>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(234, 88, 12, 0.08)',
                        border: '1px solid rgba(234, 88, 12, 0.25)',
                        color: '#C2410C',
                        fontWeight: 600,
                        marginTop: '4px',
                        lineHeight: 1.4,
                      }}
                    >
                      ⏱️ <strong>Active Rule:</strong> Customer orders will directly go to Support with a live countdown timer. If the representative has not manually marked it ready within <strong>{autoForwardKitchenMin} minute(s)</strong>, the order will automatically advance directly into the Kitchen Queue. Support can also click "Ready to Go to Kitchen" at any moment.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '12px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      color: '#1D4ED8',
                      fontWeight: 600,
                    }}
                  >
                    🛡️ <strong>Manual Rule:</strong> Orders remain in Customer Services review until the representative explicitly marks the order "Ready to Go to Kitchen". It will never advance to the kitchen without manual approval.
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  fontSize: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(100, 116, 139, 0.08)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                ⚡ Direct Kitchen Mode: Incoming orders bypass Customer Services verification and appear in the Kitchen Queue immediately.
              </div>
            )}
          </div>

          {/* SECTION 2: CUSTOMER FOOTER & CONTACT DETAILS */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Edit Customer Website Footer Details
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Changes made here immediately update the customer footer across all branches & pages
              </p>
            </div>

            <form onSubmit={handleSaveFooterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Helpline Phone Number
                </label>
                <input
                  type="text"
                  value={helpline}
                  onChange={(e) => setHelpline(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Support & Feedback Email
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Daily Operating Hours
                </label>
                <input
                  type="text"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Lahore Branch Address
                </label>
                <input
                  type="text"
                  value={addrLahore}
                  onChange={(e) => setAddrLahore(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Islamabad Branch Address
                </label>
                <input
                  type="text"
                  value={addrIslamabad}
                  onChange={(e) => setAddrIslamabad(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Karachi Branch Address
                </label>
                <input
                  type="text"
                  value={addrKarachi}
                  onChange={(e) => setAddrKarachi(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  About Tagline / Mission
                </label>
                <textarea
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '8px',
                  padding: '13px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: 'none',
                  boxShadow: '0 4px 14px var(--primary-glow)',
                }}
              >
                <Save size={16} />
                <span>Save Customer Services Routing & Footer Settings</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: REPRESENTATIVE PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              maxWidth: '680px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Branch Manager Permission Delegation
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            According to operational policy, Branch Managers can authorize Branch Representatives to edit menu items, prices, and categories.
          </p>

          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                Allow Branch Representative to Edit Menu & Categories
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                When enabled, the Representative can add, edit, and delete items and categories.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const nextState = !allowRepresentativeMenuEdit;
                setAllowRepresentativeMenuEdit(nextState);
                addToast({
                  type: 'info',
                  title: nextState ? 'Permission Granted' : 'Permission Revoked',
                  message: nextState
                    ? 'Branch Representative can now edit menu items & categories.'
                    : 'Branch Representative menu editing disabled.',
                });
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: allowRepresentativeMenuEdit ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              {allowRepresentativeMenuEdit ? <ToggleRight size={38} /> : <ToggleLeft size={38} />}
            </button>
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Status: <strong>{allowRepresentativeMenuEdit ? 'PERMITTED (Active)' : 'DISABLED (Manager Only)'}</strong>
          </div>
        </div>
        </div>
      )}

      {/* TAB: HERO BANNERS & CHEF DEAL MANAGEMENT */}
      {activeTab === 'banners' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
          {/* PENDING APPROVAL REQUESTS QUEUE (If any) */}
          {pendingApprovalRequests.filter((r) => r.status === 'pending').length > 0 && (
            <div
              style={{
                padding: '20px 24px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: '#FFFBEB',
                border: '1px solid #F59E0B',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="#D97706" />
                  <span style={{ fontWeight: 800, fontSize: '15px', color: '#92400E' }}>
                    Pending Approval Requests ({pendingApprovalRequests.filter((r) => r.status === 'pending').length})
                  </span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#B45309' }}>
                  Action required before displaying on customer screen
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingApprovalRequests
                  .filter((r) => r.status === 'pending')
                  .map((req) => (
                    <div
                      key={req.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #FCD34D',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '650px' }}>
                        <div
                          style={{
                            width: '68px',
                            height: '50px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            backgroundColor: '#F3F4F6',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={req.type === 'banner' ? req.bannerData?.imageUrl : req.dealData?.imageUrl}
                            alt="Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: req.type === 'banner' ? 'var(--primary-light)' : '#FEF3C7',
                                color: req.type === 'banner' ? 'var(--primary)' : '#92400E',
                                textTransform: 'uppercase',
                              }}
                            >
                              {req.type === 'banner' ? 'Hero Banner' : 'Chef Special Deal'} • {req.action}
                            </span>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              Submitted by <strong>{req.submittedBy}</strong> at {req.submittedAt}
                            </span>
                          </div>

                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)', marginTop: '4px' }}>
                            {req.type === 'banner' ? req.bannerData?.title : req.dealData?.title}
                            {req.type === 'deal' && req.dealData?.price && ` (${req.dealData.price})`}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {req.type === 'banner' ? req.bannerData?.subtitle : req.dealData?.subtitle}
                          </div>
                        </div>
                      </div>

                      {/* Approval Actions */}
                      {currentRole === 'branch_manager' || currentRole === 'platform_owner' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => approveRequest(req.id)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: '#16A34A',
                              color: '#FFFFFF',
                              fontSize: '13px',
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
                            }}
                          >
                            <Check size={15} />
                            <span>Approve & Publish to Display</span>
                          </button>
                          <button
                            onClick={() => rejectRequest(req.id)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: '#F3F4F6',
                              color: '#DC2626',
                              fontSize: '13px',
                              fontWeight: 700,
                              border: '1px solid #E5E7EB',
                              cursor: 'pointer',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: '#FEF3C7',
                            color: '#B45309',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          ⏳ Waiting for Branch Manager Approval
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* SECTION 1: CHEF SPECIAL DEAL CARD (Royal Chicken Dum Biryani) */}
          <div
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Featured Deal Card (Hero Right Side)
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: 'var(--text-main)' }}>
                  Change Chef Special Deal (Interactive 3D Showcase)
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Displayed directly alongside the hero headline on customer home page
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateDealCard({
                  title: dealTitle.trim() || 'Royal Chicken Dum Biryani',
                  subtitle: dealSubtitle.trim(),
                  price: dealPrice.trim() || 'Rs. 650',
                  tag: dealTag.trim() || "🌟 TODAY'S CHEF SPECIAL",
                  imageUrl: dealImageUrl.trim() || '/food-biryani.jpg',
                  categoryLink: dealCategory,
                });
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px',
                alignItems: 'start',
              }}
            >
              {/* Form Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Deal Title *
                  </label>
                  <input
                    type="text"
                    value={dealTitle}
                    onChange={(e) => setDealTitle(e.target.value)}
                    placeholder="e.g. Royal Chicken Dum Biryani"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Deal Subtitle / Preparation Detail
                  </label>
                  <input
                    type="text"
                    value={dealSubtitle}
                    onChange={(e) => setDealSubtitle(e.target.value)}
                    placeholder="e.g. Slow-steamed in copper handi with saffron & house spices"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Price *
                    </label>
                    <input
                      type="text"
                      value={dealPrice}
                      onChange={(e) => setDealPrice(e.target.value)}
                      placeholder="e.g. Rs. 650"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13.5px',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Badge / Tag *
                    </label>
                    <input
                      type="text"
                      value={dealTag}
                      onChange={(e) => setDealTag(e.target.value)}
                      placeholder="e.g. 🌟 TODAY'S CHEF SPECIAL"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13.5px',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Image URL or Preset
                  </label>
                  <input
                    type="text"
                    value={dealImageUrl}
                    onChange={(e) => setDealImageUrl(e.target.value)}
                    placeholder="/food-biryani.jpg or https://..."
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setDealImageUrl('/food-biryani.jpg')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card-subtle)',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Use /food-biryani.jpg
                    </button>
                    <button
                      type="button"
                      onClick={() => setDealImageUrl('/hero-bg.jpg')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card-subtle)',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Use /hero-bg.jpg
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Target Menu Category (When customer clicks deal)
                  </label>
                  <select
                    value={dealCategory}
                    onChange={(e) => setDealCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '12px 20px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 800,
                    boxShadow: '0 4px 14px var(--primary-glow)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '8px',
                  }}
                >
                  <Save size={16} />
                  <span>
                    {allowRepresentativeDirectPublish || currentRole !== 'branch_representative'
                      ? 'Save & Publish Deal Live'
                      : 'Submit Deal for Manager Approval'}
                  </span>
                </button>
              </div>

              {/* Deal Card Live Preview */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  border: '1px solid var(--border-color)',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Live Deal Card Preview (Customer View)
                </div>

                <div
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ height: '170px', position: 'relative', overflow: 'hidden' }}>
                    <img
                      src={dealImageUrl}
                      alt={dealTitle}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/food-biryani.jpg';
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      {dealTag}
                    </span>
                  </div>
                  <div style={{ padding: '14px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>
                      {dealTitle}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.35 }}>
                      {dealSubtitle}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>
                        {dealPrice}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                        }}
                      >
                        Order Now →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* SECTION 2: HERO CAROUSEL BANNERS (Row of Changeable Pictures) */}
          <div
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Customer Home Main Hero Carousel
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: 'var(--text-main)' }}>
                  Hero Banner Slides ({heroBanners.length} Active Slides)
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Slides auto-rotate every 5 seconds on the customer screen and appear in the clickable thumbnail row.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsNewBanner(true);
                  setEditingBanner({
                    id: `b-${Date.now()}`,
                    title: '',
                    subtitle: '',
                    badge: '🔥 Special Showcase',
                    imageUrl: '/hero-bg.jpg',
                    categoryLink: categories[0] || 'Biryani & Rice',
                    active: true,
                  });
                  setBannerTitle('');
                  setBannerSubtitle('');
                  setBannerBadge('🔥 Special Showcase');
                  setBannerImageUrl('/hero-bg.jpg');
                  setBannerCategory(categories[0] || 'Biryani & Rice');
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 10px var(--primary-glow)',
                }}
              >
                <Plus size={16} />
                <span>+ Add New Hero Banner Slide</span>
              </button>
            </div>

            {/* Grid of Banners */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                gap: '18px',
              }}
            >
              {heroBanners.map((banner, index) => (
                <div
                  key={banner.id}
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ height: '140px', position: 'relative', overflow: 'hidden' }}>
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/hero-bg.jpg';
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 100%)',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(4px)',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      Slide #{index + 1}
                    </span>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '10px',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      {banner.badge}
                    </span>
                  </div>

                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                      {banner.title}
                    </div>
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {banner.subtitle}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '6px' }}>
                      Linked Menu Category: <strong>{banner.categoryLink || 'All Menu'}</strong>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '8px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-color)',
                      }}
                    >
                      <button
                        onClick={() => {
                          setIsNewBanner(false);
                          setEditingBanner(banner);
                          setBannerTitle(banner.title);
                          setBannerSubtitle(banner.subtitle);
                          setBannerBadge(banner.badge);
                          setBannerImageUrl(banner.imageUrl);
                          setBannerCategory(banner.categoryLink || categories[0] || 'Biryani & Rice');
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>

                      {heroBanners.length > 1 && (
                        <button
                          onClick={() => setDeleteBannerTarget(banner)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'transparent',
                            border: '1px solid transparent',
                            color: '#DC2626',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Item Create / Edit Modal */}
      {editingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(26, 26, 26, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {isNewItem ? 'New Dish' : 'Edit Dish'}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Item Name
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Mutton Shinwari Karahi"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Base Price (Rs.)
                  </label>
                  <input
                    type="number"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(parseInt(e.target.value) || 0)}
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Photo & Image URL */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Dish Photo / Image URL
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <img
                    src={itemImage}
                    alt="Preview"
                    style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/food-biryani.jpg';
                    }}
                  />
                  <input
                    type="text"
                    value={itemImage}
                    onChange={(e) => setItemImage(e.target.value)}
                    placeholder="/food-biryani.jpg or image URL"
                    required
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setItemImage('/food-biryani.jpg')}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    Biryani Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemImage('/hero-bg.jpg')}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    Dining Photo
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Description / Recipe Details
                </label>
                <textarea
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Describe ingredients, cooking technique, and portion size..."
                  rows={2}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>

              {/* Per-Branch Availability & Price Overrides */}
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Branch Availability & Custom Pricing
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {branches.map((b) => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={itemBranchAvail[b.id] ?? true}
                          onChange={(e) =>
                            setItemBranchAvail({
                              ...itemBranchAvail,
                              [b.id]: e.target.checked,
                            })
                          }
                        />
                        <span>{b.name}</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rs.</span>
                        <input
                          type="number"
                          placeholder={itemPrice.toString()}
                          value={itemBranchPrices[b.id] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : undefined;
                            const next = { ...itemBranchPrices };
                            if (val === undefined) {
                              delete next[b.id];
                            } else {
                              next[b.id] = val;
                            }
                            setItemBranchPrices(next);
                          }}
                          style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '12px' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="itemAvailCheckbox"
                  checked={itemAvailable}
                  onChange={(e) => setItemAvailable(e.target.checked)}
                />
                <label htmlFor="itemAvailCheckbox" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer' }}>
                  Available in Stock (Active on Customer Menu)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                  }}
                >
                  {isNewItem ? 'Create Item' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deleteItemTarget && (
        <ModalConfirmation
          isOpen={true}
          onClose={() => setDeleteItemTarget(null)}
          onConfirm={() => {
            deleteMenuItem(deleteItemTarget.id);
            setDeleteItemTarget(null);
          }}
          title="Delete Menu Item?"
          message={`Are you sure you want to delete ${deleteItemTarget.name} from the cafe menu?`}
          details="This will remove the item from all branch menus immediately."
          confirmText="Yes, delete item"
          cancelText="No, keep item"
          isDanger
        />
      )}

      {/* Hero Banner Create / Edit Modal */}
      {editingBanner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(26, 26, 26, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              maxWidth: '540px',
              width: '100%',
              padding: '28px',
              boxShadow: 'var(--shadow-xl)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {isNewBanner ? 'New Banner' : 'Edit Banner'}
              </h3>
              <button
                onClick={() => setEditingBanner(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!bannerTitle.trim() || !editingBanner) return;

                const payload: HeroBanner = {
                  id: editingBanner.id,
                  title: bannerTitle.trim(),
                  subtitle: bannerSubtitle.trim(),
                  badge: bannerBadge.trim() || '🔥 Special Highlight',
                  imageUrl: bannerImageUrl.trim() || '/hero-bg.jpg',
                  categoryLink: bannerCategory,
                  active: true,
                };

                if (isNewBanner) {
                  addHeroBanner(payload);
                } else {
                  updateHeroBanner(payload);
                }

                setEditingBanner(null);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Hero Headline Title *
                </label>
                <input
                  type="text"
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  placeholder="e.g. Eat Fresh & Healthy, Cooked with Passion"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Subtitle / Promo Description
                </label>
                <textarea
                  value={bannerSubtitle}
                  onChange={(e) => setBannerSubtitle(e.target.value)}
                  placeholder="e.g. Authentic clay oven dum biryanis, organic desi ghee Shinwari karahi..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Eyebrow Badge Tag *
                  </label>
                  <input
                    type="text"
                    value={bannerBadge}
                    onChange={(e) => setBannerBadge(e.target.value)}
                    placeholder="e.g. 🔥 Chef Handi Special"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Linked Menu Category
                  </label>
                  <select
                    value={bannerCategory}
                    onChange={(e) => setBannerCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Background Image URL
                </label>
                <input
                  type="text"
                  value={bannerImageUrl}
                  onChange={(e) => setBannerImageUrl(e.target.value)}
                  placeholder="/hero-bg.jpg or https://..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setBannerImageUrl('/hero-bg.jpg')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Preset /hero-bg.jpg
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerImageUrl('/food-biryani.jpg')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Preset /food-biryani.jpg
                  </button>
                </div>
              </div>

              {/* Mini Preview */}
              <div
                style={{
                  height: '110px',
                  borderRadius: '12px',
                  position: 'relative',
                  overflow: 'hidden',
                  marginTop: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <img
                  src={bannerImageUrl}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/hero-bg.jpg';
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '12px 16px',
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#FFA270', fontWeight: 800, textTransform: 'uppercase' }}>
                    {bannerBadge || 'PREVIEW BADGE'}
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>
                    {bannerTitle || 'Banner Title Preview'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '11px 18px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Save size={15} />
                  <span>
                    {allowRepresentativeDirectPublish || currentRole !== 'branch_representative'
                      ? 'Save & Publish Banner Live'
                      : 'Submit Banner for Manager Approval'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBanner(null)}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Banner Confirmation Modal */}
      {deleteBannerTarget && (
        <ModalConfirmation
          isOpen={true}
          onClose={() => setDeleteBannerTarget(null)}
          onConfirm={() => {
            deleteHeroBanner(deleteBannerTarget.id);
            setDeleteBannerTarget(null);
          }}
          title="Delete Hero Banner Slide?"
          message={`Are you sure you want to remove "${deleteBannerTarget.title}" from the customer home carousel?`}
          details={
            allowRepresentativeDirectPublish || currentRole !== 'branch_representative'
              ? 'This will remove the slide immediately from customer view.'
              : 'This deletion request will be submitted for Branch Manager approval.'
          }
          confirmText="Yes, delete banner"
          cancelText="No, keep banner"
          isDanger
        />
      )}
    </div>
  );
};
