'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp, useAppSelector, selectCartCount, selectCartSubtotal, getItemMinPrice } from '@/context/AppContext';
import { MenuItem, Branch } from '@/types/cafe';
import { CustomerLoginModal } from './CustomerLoginModal';
import { DeliveryMapModal } from '@/components/common/DeliveryMapModal';
import {
  Search,
  AlertTriangle,
  Clock,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Filter,
  Flame,
  CheckCircle,
  UtensilsCrossed,
  Utensils,
  Bike,
  X,
  Sparkles,
  MapPin,
  Phone,
  User,
  Banknote,
  ArrowLeft,
  CheckCircle2,
  Tag,
  Upload,
} from 'lucide-react';
import { resolveDishImage } from '@/lib/dishImages';
import { BranchPickerModal } from '@/components/common/BranchPickerModal';
import { distanceMeters, resolveBranchCoords, resolveTableQrRadius } from '@/lib/tableQrGeofence';

interface MenuScreenProps {
  onNavigate: (view: string) => void;
  onOpenCart: () => void;
  onProceedToCheckout?: () => void;
  isTableQrMode?: boolean;
  initialTableNumber?: string;
}

export const CustomerMenu: React.FC<MenuScreenProps> = ({
  onNavigate,
  onOpenCart,
  onProceedToCheckout,
  isTableQrMode,
  initialTableNumber,
}) => {
  const {
    currentBranch,
    tables,
    hasSelectedBranch,
    menuItems,
    currentBranchId,
    cart,
    categories: appCategories,
    addToCart,
    updateCartItemQty,
    clearCart,
    placeOrder,
    activeTableSession,
    menuSearchQuery,
    setMenuSearchQuery,
    currentUser,
    setCurrentUser,
    addToast,
    setBranchUnavailableModal,
    orderType,
    setOrderType,
    hasConfirmedOrderType,
    setHasConfirmedOrderType,
    selectedDeliveryAddress,
    setSelectedDeliveryAddress,
    setCurrentBranchId,
    dealCard,
    announcements,
    updateDealCard,
    currentRole,
  } = useApp();

  // Order Menu Deals Section: Load photos directly from Local Storage
  const [localDealPhotos, setLocalDealPhotos] = useState<string[]>(() => {
    const defaults = ['/food-biryani.jpg', '/hero-bg.jpg'];
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = localStorage.getItem('foodies_local_deal_photos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaults;
  });

  const [storedDealImage, setStoredDealImage] = useState<string>(() => {
    if (typeof window === 'undefined') return dealCard?.imageUrl || '/food-biryani.jpg';
    try {
      const directImg = localStorage.getItem('foodies_local_deal_card_image');
      if (directImg) return directImg;
      const savedCardRaw = localStorage.getItem('foodies_deal_card');
      if (savedCardRaw) {
        const parsed = JSON.parse(savedCardRaw);
        if (parsed?.imageUrl) return parsed.imageUrl;
      }
    } catch {}
    return dealCard?.imageUrl || '/food-biryani.jpg';
  });

  const [announcementPhotosMap, setAnnouncementPhotosMap] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('foodies_announcement_photos');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const directImg = localStorage.getItem('foodies_local_deal_card_image');
      if (directImg) setStoredDealImage(directImg);
      else if (dealCard?.imageUrl) setStoredDealImage(dealCard.imageUrl);
      const rawGallery = localStorage.getItem('foodies_local_deal_photos');
      if (rawGallery) {
        const parsed = JSON.parse(rawGallery);
        if (Array.isArray(parsed) && parsed.length > 0) setLocalDealPhotos(parsed);
      }
      const rawAnn = localStorage.getItem('foodies_announcement_photos');
      if (rawAnn) setAnnouncementPhotosMap(JSON.parse(rawAnn));
    } catch {}
  }, [dealCard?.imageUrl]);

  const canEditDealPhotos = currentRole === 'branch_manager' || currentRole === 'platform_owner' || currentRole === 'cashier';

  const handleUploadMenuDealPhoto = (file: File) => {
    if (!file) return;
    if (file.size > 1.8 * 1024 * 1024) {
      addToast({ type: 'warning', title: 'Large Photo', message: 'Choose a photo under 1.8MB for Local Storage.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!dataUrl) return;
      setStoredDealImage(dataUrl);
      setLocalDealPhotos((prev) => {
        const next = [dataUrl, ...prev.filter((p) => p !== dataUrl)].slice(0, 12);
        try {
          localStorage.setItem('foodies_local_deal_photos', JSON.stringify(next));
          localStorage.setItem('foodies_local_deal_card_image', dataUrl);
          localStorage.setItem('foodies_deal_card', JSON.stringify({ ...dealCard, imageUrl: dataUrl }));
        } catch {}
        return next;
      });
      if (updateDealCard) {
        updateDealCard({ ...dealCard, imageUrl: dataUrl });
      }
      addToast({ type: 'success', title: 'Deal Photo Updated', message: 'Saved to Local Storage for Order Menu Deals.' });
    };
    reader.readAsDataURL(file);
  };

  // Order Type Selection Pop-up Modal state
  const [orderTypeModalOpen, setOrderTypeModalOpen] = useState(false);
  const [branchPickerFor, setBranchPickerFor] = useState<'dine_in' | 'takeaway' | null>(null);
  const [deliveryMapModalOpen, setDeliveryMapModalOpen] = useState(false);

  // Web Checkout Experience States
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [checkoutRightStep, setCheckoutRightStep] = useState<'table' | 'bill'>('table');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [customerName, setCustomerName] = useState(() => {
    if (typeof window !== 'undefined') {
      const userKey = currentUser?.id && currentUser.id !== 'user-guest' ? currentUser.id : 'guest';
      const saved = localStorage.getItem(`foodies_saved_name_${userKey}`) || localStorage.getItem('foodies_saved_customer_name');
      if (saved) return saved;
    }
    return currentUser?.name && currentUser.name !== 'Guest Customer' ? currentUser.name : '';
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      const userKey = currentUser?.id && currentUser.id !== 'user-guest' ? currentUser.id : 'guest';
      const saved = localStorage.getItem(`foodies_saved_phone_${userKey}`) || localStorage.getItem('foodies_saved_customer_phone');
      if (saved) return saved;
    }
    return currentUser?.phone || '';
  });
  const [deliveryAddress, setDeliveryAddress] = useState(selectedDeliveryAddress || 'Main Boulevard, Gulberg III, Lahore');

  useEffect(() => {
    if (selectedDeliveryAddress) {
      setDeliveryAddress(selectedDeliveryAddress);
    }
  }, [selectedDeliveryAddress]);

  const isTableQr = useMemo(() => {
    if (isTableQrMode) return true;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('tableQr') || p.get('table') || p.get('token')) return true;
    }
    return false;
  }, [isTableQrMode]);

  const tableFromUrl = useMemo(() => {
    if (initialTableNumber) return initialTableNumber;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const val = p.get('tableQr') || p.get('table');
      if (val) {
        return val.toUpperCase().startsWith('T-') ? val.toUpperCase() : `T-${val.padStart(2, '0')}`;
      }
    }
    return undefined;
  }, [initialTableNumber]);

  const [selectedTableNumber, setSelectedTableNumber] = useState<string>(() => {
    if (initialTableNumber) return initialTableNumber;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const val = p.get('tableQr') || p.get('table');
      if (val) {
        return val.toUpperCase().startsWith('T-') ? val.toUpperCase() : `T-${val.padStart(2, '0')}`;
      }
    }
    return activeTableSession?.tableNumber || 'T-01';
  });

  // When in Table QR mode, lock into dine-in order type and assign table immediately
  useEffect(() => {
    if (isTableQr) {
      setOrderType('dine_in');
      setHasConfirmedOrderType(true);
      if (tableFromUrl) {
        setSelectedTableNumber(tableFromUrl);
      }
      if (typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search);
        const branchParam = p.get('branch');
        if (branchParam && setCurrentBranchId) {
          setCurrentBranchId(branchParam);
        }
      }
    }
  }, [isTableQr, tableFromUrl, setOrderType, setHasConfirmedOrderType, setCurrentBranchId]);

  // ── Table-QR geofence: a scanned QR can only order within the branch's radius (default 300 m) ──
  const qrRadiusMeters = resolveTableQrRadius(currentBranch?.tableQrMaxDistanceMeters);
  const qrBranchCoords = useMemo(
    () => resolveBranchCoords(currentBranch || {}),
    [currentBranch?.latitude, currentBranch?.longitude, currentBranch?.city] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [qrGeo, setQrGeo] = useState<{
    status: 'idle' | 'checking' | 'inside' | 'outside' | 'denied' | 'unsupported';
    distance: number | null;
    coords: { lat: number; lng: number } | null;
    message?: string;
  }>({ status: 'idle', distance: null, coords: null });

  const checkQrLocation = React.useCallback(
    (notify = false): Promise<{ lat: number; lng: number } | null> =>
      new Promise((resolve) => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
          setQrGeo({ status: 'unsupported', distance: null, coords: null, message: 'This device cannot share its location, so table ordering is locked.' });
          resolve(null);
          return;
        }
        setQrGeo((g) => ({ ...g, status: 'checking' }));
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const dist = distanceMeters(coords.lat, coords.lng, qrBranchCoords.lat, qrBranchCoords.lng);
            const inside = dist <= qrRadiusMeters;
            setQrGeo({ status: inside ? 'inside' : 'outside', distance: dist, coords });
            if (notify && !inside) {
              addToast({
                type: 'error',
                title: 'Too far from the cafe 🚫',
                message: `You are ${dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`} from ${currentBranch?.name || 'the branch'}. Table QR orders are allowed within ${qrRadiusMeters} m only.`,
              });
            }
            resolve(inside ? coords : null);
          },
          (err) => {
            const message =
              err.code === 1
                ? 'Location permission was denied. Allow location access to order from your table.'
                : 'Could not get your location. Turn on device location and try again.';
            setQrGeo({ status: 'denied', distance: null, coords: null, message });
            if (notify) addToast({ type: 'warning', title: 'Location needed 📍', message });
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
        );
      }),
    [qrBranchCoords.lat, qrBranchCoords.lng, qrRadiusMeters, currentBranch?.name, addToast]
  );

  const checkQrLocationRef = useRef(checkQrLocation);
  checkQrLocationRef.current = checkQrLocation;
  useEffect(() => {
    if (isTableQr) void checkQrLocationRef.current(false);
  }, [isTableQr, qrBranchCoords.lat, qrBranchCoords.lng, qrRadiusMeters]);

  // Screen width detection for screen-adaptive checkout (desktop 2-column vs mobile drawer)
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 860 : true));
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(typeof window !== 'undefined' ? window.innerWidth > 860 : true);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  const normCurrentBranch = useMemo(() => {
    const id = currentBranchId || 'gulberg-lahore';
    if (id.includes('gulberg')) return 'gulberg-lahore';
    if (id.includes('f7') || id.includes('islamabad')) return 'f7-islamabad';
    if (id.includes('clifton') || id.includes('karachi')) return 'clifton-karachi';
    return id;
  }, [currentBranchId]);

  const branchTables = useMemo(() => {
    const list = (tables || []).filter(
      (t) => !t.branchId || t.branchId === currentBranchId || t.branchId.includes(normCurrentBranch.split('-')[0])
    );
    return list.length > 0 ? list : (tables || []);
  }, [tables, currentBranchId, normCurrentBranch]);

  const availableFloors = useMemo(() => {
    const set = new Set<string>();
    branchTables.forEach((t) => {
      if (t.floor) set.add(t.floor.trim());
    });
    const list = Array.from(set);
    return list.length > 0 ? list : ['Ground Floor', '1st Floor', 'Rooftop Terrace'];
  }, [branchTables]);

  const [selectedFloor, setSelectedFloor] = useState<string>('Ground Floor');

  useEffect(() => {
    if (availableFloors.length > 0 && !availableFloors.includes(selectedFloor)) {
      setSelectedFloor(availableFloors[0]);
    }
  }, [availableFloors, selectedFloor]);

  const floorTables = useMemo(() => {
    const filtered = branchTables.filter((t) => {
      const f = (t.floor || 'Ground Floor').toLowerCase();
      const s = selectedFloor.toLowerCase().split('(')[0].trim();
      return f.includes(s) || s.includes(f.split('(')[0].trim());
    });
    return filtered.length > 0 ? filtered : branchTables;
  }, [branchTables, selectedFloor]);

  useEffect(() => {
    if (isTableQr && (tableFromUrl || selectedTableNumber)) return;
    if (floorTables.length > 0) {
      const match = floorTables.find((t) => t.number === selectedTableNumber);
      if (!match) {
        const firstAvail = floorTables.find((t) => t.status === 'available') || floorTables[0];
        if (firstAvail) setSelectedTableNumber(firstAvail.number);
      }
    }
  }, [floorTables, selectedTableNumber, isTableQr, tableFromUrl]);

  const isCustomerLoggedIn = Boolean(
    currentUser &&
    (currentUser.email || (currentUser.name && currentUser.name !== 'Guest Customer')) &&
    currentUser.role === 'customer'
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userKey = currentUser?.id && currentUser.id !== 'user-guest' ? currentUser.id : 'guest';
      const savedName = localStorage.getItem(`foodies_saved_name_${userKey}`) || localStorage.getItem('foodies_saved_customer_name');
      const savedPhone = localStorage.getItem(`foodies_saved_phone_${userKey}`) || localStorage.getItem('foodies_saved_customer_phone');
      if (savedName && !customerName) setCustomerName(savedName);
      if (savedPhone && !customerPhone) setCustomerPhone(savedPhone);
    }
    if (currentUser?.name && currentUser.name !== 'Guest Customer' && !customerName) {
      setCustomerName(currentUser.name);
    }
    if (currentUser?.phone && !customerPhone) {
      setCustomerPhone(currentUser.phone);
    }
  }, [currentUser]);

  // When login completes while login modal is open, advance directly
  useEffect(() => {
    if (loginModalOpen && isCustomerLoggedIn) {
      setLoginModalOpen(false);
      if (isDesktop) {
        if (!hasConfirmedOrderType) {
          setOrderTypeModalOpen(true);
        } else {
          setIsCheckoutMode(true);
          if (orderType === 'dine_in') {
            setCheckoutRightStep('table');
          } else {
            setCheckoutRightStep('bill');
          }
        }
      } else {
        if (!hasConfirmedOrderType) {
          setOrderTypeModalOpen(true);
        } else {
          if (onProceedToCheckout) {
            onProceedToCheckout();
          } else if (onOpenCart) {
            onOpenCart();
          }
        }
      }
    }
  }, [loginModalOpen, isCustomerLoggedIn, hasConfirmedOrderType, isDesktop, orderType, onProceedToCheckout, onOpenCart]);

  // Return to menu if cart becomes empty
  useEffect(() => {
    if (cart.length === 0 && isCheckoutMode) {
      setIsCheckoutMode(false);
    }
  }, [cart.length, isCheckoutMode]);

  const searchQuery = menuSearchQuery;
  const [unavailableModalDish, setUnavailableModalDish] = useState<MenuItem | null>(null);

  // Synchronized catalog with Staff Menu & Prices page
  const allMenuItems = useMemo(() => {
    return menuItems || [];
  }, [menuItems]);

  // Dynamically ensure categories match the active categories and uploaded menu items
  const categories: string[] = useMemo(() => {
    const list: string[] = [];
    (appCategories || []).forEach((c) => {
      if (!list.includes(c)) {
        list.push(c);
      }
    });
    (allMenuItems || []).forEach((item) => {
      if (item.category && !list.includes(item.category)) {
        list.push(item.category);
      }
    });
    return list.length > 0
      ? list
      : ['Biryani & Rice', 'Karahi & Handi', 'BBQ & Kebabs', 'Burgers & Fast Food', 'Tandoor & Breads', 'Beverages & Desserts'];
  }, [appCategories, allMenuItems]);

  const [selectedCategory, setSelectedCategory] = useState<string>(() => categories[0] || 'Biryani & Rice');

  const categoryRowRef = useRef<HTMLDivElement>(null);
  const categoryBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isManualScrollRef = useRef(false);

  // "You May Also Like" drag-up and page scroll listeners
  const youMayLikeRowRef = useRef<HTMLDivElement>(null);
  const isPointerDraggingRef = useRef(false);
  const pointerStartYRef = useRef(0);
  const pointerStartScrollYRef = useRef(0);

  const handleYouMayLikePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isPointerDraggingRef.current = true;
    pointerStartYRef.current = e.clientY;
    pointerStartScrollYRef.current = window.scrollY;
  };

  const handleYouMayLikePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDraggingRef.current) return;
    const deltaY = pointerStartYRef.current - e.clientY;
    if (Math.abs(deltaY) > 3) {
      window.scrollTo({
        top: pointerStartScrollYRef.current + deltaY,
        behavior: 'auto',
      });
    }
  };

  const handleYouMayLikePointerUp = () => {
    isPointerDraggingRef.current = false;
  };

  // Sync selectedCategory if categories loaded later
  useEffect(() => {
    if (categories && categories.length > 0) {
      if (!selectedCategory || !categories.includes(selectedCategory)) {
        setSelectedCategory(categories[0]);
      }
    }
  }, [categories, selectedCategory]);

  // Helper to match item categories robustly (with alias support)
  const isItemInCategory = (itemCat: string, sectionCat: string) => {
    if (itemCat === sectionCat) return true;
    const norm = (s: string) => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
    const iNorm = norm(itemCat);
    const sNorm = norm(sectionCat);
    if (iNorm === sNorm) return true;
    if (sNorm === 'deals' && (iNorm.includes('deal') || iNorm.includes('combo'))) return true;
    if ((iNorm.includes('karahi') || iNorm.includes('shinwari')) && (sNorm.includes('karahi') || sNorm.includes('shinwari'))) return true;
    if ((iNorm.includes('tandoor') || iNorm.includes('bread')) && (sNorm.includes('tandoor') || sNorm.includes('bread'))) return true;
    return false;
  };

  // Filtered items when searching
  const filteredItems = allMenuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Handle clicking a category tab: smooth scroll to that category section
  const handleCategoryClick = (cat: string) => {
    setSelectedCategory(cat);
    isManualScrollRef.current = true;

    const sectionEl = document.getElementById(`cat-section-${encodeURIComponent(cat)}`);
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      isManualScrollRef.current = false;
    }, 850);
  };

  // Automatically scroll active category button into view horizontally whenever selectedCategory changes
  useEffect(() => {
    if (!selectedCategory) return;
    const btn = categoryBtnRefs.current[selectedCategory];
    const row = categoryRowRef.current;
    if (btn && row) {
      const scrollLeftTarget = btn.offsetLeft - row.offsetWidth / 2 + btn.offsetWidth / 2;
      row.scrollTo({
        left: Math.max(0, scrollLeftTarget),
        behavior: 'smooth',
      });
    }
  }, [selectedCategory]);

  // ScrollSpy: Automatically update category in top row as customer scrolls down
  // When a category's full item card is on display, color that category in the top row
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;

    const handleScroll = () => {
      if (isManualScrollRef.current) return;
      if (searchQuery.trim().length > 0) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const pureCats = categories || [];
          if (pureCats.length === 0) {
            ticking = false;
            return;
          }

          // When near the top, pick first category
          if (window.scrollY < 50) {
            setSelectedCategory((prev) => (prev !== pureCats[0] ? pureCats[0] : prev));
            ticking = false;
            return;
          }

          // Top boundary below sticky header (72px) + sticky category bar (~44px)
          const topBoundary = 118;
          // Bottom boundary of visible window (accounting for mobile checkout bar if present)
          const bottomBoundary = window.innerHeight - (cart.length > 0 ? 68 : 10);

          // Find all dish cards with a data-category attribute
          const cards = Array.from(
            document.querySelectorAll<HTMLElement>('.foodies-dish-card[data-category]')
          );

          let activeCat: string | null = null;

          // 1. Priority 1: Find the first dish card that is at FULL DISPLAY (its entire box is inside the viewport)
          for (const card of cards) {
            const rect = card.getBoundingClientRect();
            if (rect.top >= topBoundary - 6 && rect.bottom <= bottomBoundary + 6) {
              const cat = card.getAttribute('data-category');
              if (cat && pureCats.includes(cat)) {
                activeCat = cat;
                break;
              }
            }
          }

          // 2. Priority 2 (fallback during rapid scroll or between rows):
          // Find the card that has the largest visible vertical height in the viewport window
          if (!activeCat && cards.length > 0) {
            let maxVisibleHeight = 0;
            let bestCat: string | null = null;

            for (const card of cards) {
              const rect = card.getBoundingClientRect();
              const visibleTop = Math.max(rect.top, topBoundary);
              const visibleBottom = Math.min(rect.bottom, bottomBoundary);
              const visibleHeight = visibleBottom - visibleTop;

              if (visibleHeight > maxVisibleHeight) {
                maxVisibleHeight = visibleHeight;
                bestCat = card.getAttribute('data-category');
              }
            }

            if (bestCat && pureCats.includes(bestCat)) {
              activeCat = bestCat;
            }
          }

          if (activeCat) {
            setSelectedCategory((prev) => (prev !== activeCat ? activeCat : prev));
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [appCategories, searchQuery, cart.length]);

  // Handle smooth scroll when navigating to a specific dish from Home page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetDishId = localStorage.getItem('foodies_target_item');
    if (targetDishId) {
      localStorage.removeItem('foodies_target_item');
      const targetItem = menuItems.find((i) => i.id === targetDishId);
      if (targetItem && targetItem.category) {
        setSelectedCategory(targetItem.category);
      }
      setTimeout(() => {
        const targetElement = document.getElementById(`menu-item-${targetDishId}`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetElement.classList.add('highlight-target-dish');
          setTimeout(() => {
            targetElement.classList.remove('highlight-target-dish');
          }, 3000);
        }
      }, 350);
    } else {
      window.scrollTo(0, 0);
    }
  }, [menuItems]);

  // Redux Toolkit memoized selectors with direct React state fallback for zero-lag calculations
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const reduxCartCount = useAppSelector(selectCartCount);
  const reduxCartSubtotal = useAppSelector(selectCartSubtotal);
  const derivedCartCount = (cart || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
  const derivedSubtotal = (cart || []).reduce((sum, i) => sum + (Number(i.unitPrice) || 0) * (i.quantity || 1), 0);

  const rawCartCount = reduxCartCount > 0 ? reduxCartCount : derivedCartCount;
  const rawCartSubtotal = reduxCartSubtotal > 0 ? reduxCartSubtotal : derivedSubtotal;
  const cartCount = mounted ? rawCartCount : 0;
  const cartSubtotal = mounted ? rawCartSubtotal : 0;

  // Delivery minimum order amount calculation
  const isDelivery = orderType === 'delivery';
  const minDeliveryAmount = currentBranch?.minDeliveryAmount ?? 500;
  const isBelowMinDelivery = isDelivery && cartCount > 0 && cartSubtotal < minDeliveryAmount;
  const deliveryShortfall = Math.max(0, minDeliveryAmount - cartSubtotal);

  // Taxes and Grand Total calculations
  const tax = Math.round(cartSubtotal * 0.16);
  const deliveryFee = orderType === 'delivery' ? 150 : 0;
  const grandTotal = cartSubtotal + tax + deliveryFee;

  // Complementary "You May Also Like" items for checkout
  const youMayAlsoLikeItems = useMemo(() => {
    const cartItemIds = new Set((cart || []).map((c) => c.menuItemId || c.id));
    const cartItemNames = new Set((cart || []).map((c) => (c.name || '').toLowerCase()));

    const priorityCategories = ['Beverages', 'Desserts', 'Tandoor & Breads', 'Appetizers', 'Beverages & Desserts'];

    const filtered = (menuItems || []).filter((item) => {
      if (cartItemIds.has(item.id)) return false;
      if (cartItemNames.has((item.name || '').toLowerCase())) return false;
      const isAvailAtBranch = item.branchAvailability?.[currentBranchId] !== false && item.isAvailable !== false;
      return isAvailAtBranch;
    });

    const priorityMatches = filtered.filter((i) =>
      priorityCategories.some((cat) => (i.category || '').toLowerCase().includes(cat.toLowerCase()))
    );

    const candidates = priorityMatches.length >= 4 ? priorityMatches : filtered;
    return candidates.slice(0, 8);
  }, [menuItems, cart, currentBranchId]);

  const handleProceedClick = () => {
    if (cartCount === 0) return;

    // 1. If not signed in first: pop up screen for login first
    if (!isCustomerLoggedIn) {
      setLoginModalOpen(true);
      return;
    }

    // 2. Next page asks for order type if not confirmed yet
    if (!hasConfirmedOrderType) {
      setOrderTypeModalOpen(true);
      return;
    }

    // If delivery is chosen and below minimum:
    if (orderType === 'delivery' && cartSubtotal < minDeliveryAmount) {
      addToast({
        type: 'warning',
        title: `Select More Items for Delivery (Min Rs. ${minDeliveryAmount.toLocaleString()})`,
        message: `Please select Rs. ${deliveryShortfall.toLocaleString()} more items to cross Rs. ${minDeliveryAmount.toLocaleString()} for delivery.`,
      });
      return;
    }

    // 3. Screen-adaptive checkout branching:
    // Big Screen (Laptop/Desktop > 860px): In-page 2-column checkout with left order detail & right payment card
    // Small Screen (Mobile <= 860px): Mobile bottom-sheet checkout drawer
    if (isDesktop) {
      setIsCheckoutMode(true);
      if (orderType === 'dine_in') {
        setCheckoutRightStep('table');
      } else {
        setCheckoutRightStep('bill');
      }
    } else {
      if (onProceedToCheckout) {
        onProceedToCheckout();
      } else if (onOpenCart) {
        onOpenCart();
      }
    }
  };

  const handleDeliveryConfirmed = (addr: string, branch: Branch) => {
    setDeliveryAddress(addr);
    if (setSelectedDeliveryAddress) setSelectedDeliveryAddress(addr);
    if (setCurrentBranchId) setCurrentBranchId(branch.id);
    setOrderType('delivery');
    setHasConfirmedOrderType(true);
    setDeliveryMapModalOpen(false);

    // If customer selected Delivery and value is less than minimum delivery amount:
    if (cartSubtotal < minDeliveryAmount) {
      addToast({
        type: 'warning',
        title: `Select More Items for Delivery (Min Rs. ${minDeliveryAmount.toLocaleString()})`,
        message: `Please select Rs. ${deliveryShortfall.toLocaleString()} more items to cross Rs. ${minDeliveryAmount.toLocaleString()} for delivery.`,
      });
      return;
    }

    // Screen-adaptive checkout branching:
    if (isDesktop) {
      setIsCheckoutMode(true);
      setCheckoutRightStep('bill');
    } else {
      if (onProceedToCheckout) {
        onProceedToCheckout();
      } else if (onOpenCart) {
        onOpenCart();
      }
    }
  };

  const handleSelectOrderType = (selected: 'dine_in' | 'takeaway' | 'delivery') => {
    if (!isCustomerLoggedIn) {
      setOrderTypeModalOpen(false);
      setLoginModalOpen(true);
      return;
    }

    if (selected === 'delivery') {
      setOrderTypeModalOpen(false);
      setDeliveryMapModalOpen(true);
      return;
    }

    // Takeaway / Dine-In: choose the branch first (nearest open first, closed ones disabled).
    setOrderTypeModalOpen(false);
    setBranchPickerFor(selected);
  };

  // Runs after the customer picked a branch for Takeaway / Dine-In.
  const continueAfterBranchPicked = (selected: 'dine_in' | 'takeaway') => {
    setOrderType(selected);
    setHasConfirmedOrderType(true);
    setBranchPickerFor(null);

    // Screen-adaptive checkout branching:
    if (isDesktop) {
      setIsCheckoutMode(true);
      if (selected === 'dine_in') {
        setCheckoutRightStep('table');
      } else {
        setCheckoutRightStep('bill');
      }
    } else {
      if (onProceedToCheckout) {
        onProceedToCheckout();
      } else if (onOpenCart) {
        onOpenCart();
      }
    }
  };

  const handleConfirmAndPayCash = async () => {
    // Table QR: re-check GPS right before placing. Outside the branch radius means no order.
    let tableQrLocation: { lat: number; lng: number } | undefined;
    if (isTableQr) {
      const coords = await checkQrLocation(true);
      if (!coords) {
        setConfirmModalOpen(false);
        return;
      }
      tableQrLocation = coords;
    }

    // 0. Verify customer is authenticated
    if (!isCustomerLoggedIn) {
      setConfirmModalOpen(false);
      setLoginModalOpen(true);
      addToast({
        type: 'warning',
        title: 'Sign In Required ✉️',
        message: 'Please sign in to your customer account to place and pay for your order.',
      });
      return;
    }

    if (!customerName.trim()) {
      addToast({
        type: 'warning',
        title: 'Customer Name Required',
        message: 'Please enter your name for this order.',
      });
      return;
    }

    const cleanDigits = customerPhone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 9) {
      addToast({
        type: 'warning',
        title: 'Receiver Mobile Number Required 📱',
        message: 'Please provide a valid receiver mobile number for order delivery & rider updates.',
      });
      return;
    }

    // Resolve authenticated customer profile from context or customer session cache
    let activeCustomer = currentUser;
    if ((!activeCustomer || !activeCustomer.name || activeCustomer.name === 'Guest Customer') && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_customer_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.name && parsed.name !== 'Guest Customer') {
            activeCustomer = parsed;
          }
        }
      } catch (e) {}
    }

    const clean10 = cleanDigits.slice(-10);
    const effectiveCustomerId = activeCustomer?.id && activeCustomer.id !== 'user-guest'
      ? activeCustomer.id
      : `cust-${clean10}`;
    const effectiveCustomerName = customerName.trim() || activeCustomer?.name || (cleanDigits ? `Customer (${clean10})` : 'Customer');
    const effectiveCustomerPhone = customerPhone || activeCustomer?.phone || '';
    const effectiveCustomerEmail = activeCustomer?.email || undefined;

    const effectiveType = isTableQr ? 'dine_in' : (orderType || 'delivery');
    const effectiveTableNumber = effectiveType === 'dine_in' ? (tableFromUrl || selectedTableNumber || 'T-01') : undefined;
    const effectivePaymentMethod = effectiveType === 'delivery'
      ? 'Cash on Delivery (COD)'
      : effectiveType === 'dine_in'
      ? 'Cash at Table'
      : 'Cash at Counter';

    try {
      const placed = placeOrder(
        effectiveType,
        effectiveTableNumber,
        undefined, // tablePin
        effectiveType === 'takeaway' ? '15-25 mins' : undefined,
        effectiveType === 'delivery' ? deliveryAddress : undefined,
        effectivePaymentMethod,
        undefined, // customItems
        {
          customerId: effectiveCustomerId,
          customerName: effectiveCustomerName,
          customerPhone: effectiveCustomerPhone,
          customerEmail: effectiveCustomerEmail,
          notes: specialInstructions.trim() || (isTableQr ? 'Table QR Order' : undefined),
          paymentStatus: 'unpaid',
          paymentCollected: false,
          isTableQr: isTableQr || Boolean(effectiveType === 'dine_in' && effectiveTableNumber),
          isWalkIn: false,
          tableQrLocation,
        }
      );

      if (typeof window !== 'undefined') {
        const userKey = activeCustomer?.id && activeCustomer.id !== 'user-guest' ? activeCustomer.id : 'guest';
        if (customerName.trim()) {
          localStorage.setItem(`foodies_saved_name_${userKey}`, customerName.trim());
          localStorage.setItem('foodies_saved_customer_name', customerName.trim());
        }
        if (customerPhone.trim()) {
          localStorage.setItem(`foodies_saved_phone_${userKey}`, customerPhone.trim());
          localStorage.setItem('foodies_saved_customer_phone', customerPhone.trim());
        }
      }
      if (setCurrentUser && activeCustomer && (customerName.trim() || customerPhone.trim())) {
        setCurrentUser({
          ...activeCustomer,
          name: customerName.trim() || activeCustomer.name,
          phone: customerPhone.trim() || activeCustomer.phone,
        });
      }

      // Permanently link order to active customer account cache immediately
      if (typeof window !== 'undefined' && placed) {
        try {
          const myIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
          if (!myIds.includes(placed.id)) myIds.unshift(placed.id);
          if (placed.orderNumber && !myIds.includes(placed.orderNumber)) myIds.unshift(placed.orderNumber);
          localStorage.setItem('foodies_customer_order_ids', JSON.stringify(myIds));

          const cache = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
          const updatedCache = [placed, ...cache.filter((o: any) => o.id !== placed.id && o.orderNumber !== placed.orderNumber)];
          localStorage.setItem('foodies_customer_history_cache', JSON.stringify(updatedCache));
        } catch (e) {}
      }

      clearCart();
      setIsCheckoutMode(false);
      setConfirmModalOpen(false);

      addToast({
        type: 'success',
        title: 'Order Placed Successfully! 🎉',
        message: `Order #${placed?.orderNumber || 'FC-NEW'} has been received by the cafe.`,
      });

      onNavigate('order-tracking');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed to Place Order',
        message: err?.message || 'Please try again.',
      });
    }
  };

  // Snappy flying piece animation from clicked order item to header cart button
  const triggerFlyToCart = (
    e: React.MouseEvent,
    action: () => void,
    dishImage?: string
  ) => {
    e.stopPropagation();

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      action();
      return;
    }

    const cartBtn =
      document.querySelector<HTMLElement>('.header-cart-button') ||
      document.querySelector<HTMLElement>('.foodies-mobile-checkout-bar');

    if (!cartBtn) {
      action();
      return;
    }

    const sourceEl = (e.currentTarget as HTMLElement) || (e.target as HTMLElement);
    const srcRect = sourceEl.getBoundingClientRect();
    const destRect = cartBtn.getBoundingClientRect();

    const startX = srcRect.left + srcRect.width / 2;
    const startY = srcRect.top + srcRect.height / 2;
    const endX = destRect.left + destRect.width / 2;
    const endY = destRect.top + destRect.height / 2;

    const particle = document.createElement('div');
    particle.className = 'foodies-flying-piece';
    particle.style.position = 'fixed';
    particle.style.zIndex = '999999';
    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;
    particle.style.width = '24px';
    particle.style.height = '24px';
    particle.style.marginLeft = '-12px';
    particle.style.marginTop = '-12px';
    particle.style.borderRadius = '50%';
    particle.style.backgroundColor = 'var(--primary, #E53E3E)';
    particle.style.border = '2px solid #FFFFFF';
    particle.style.boxShadow = '0 4px 14px rgba(229, 62, 62, 0.6)';
    particle.style.pointerEvents = 'none';
    particle.style.display = 'flex';
    particle.style.alignItems = 'center';
    particle.style.justifyContent = 'center';
    particle.style.transition = 'all 420ms cubic-bezier(0.2, 0.8, 0.25, 1)';
    particle.style.transform = 'translate(0, 0) scale(1)';
    particle.style.opacity = '1';

    if (dishImage) {
      particle.style.backgroundImage = `url("${dishImage}")`;
      particle.style.backgroundSize = 'cover';
      particle.style.backgroundPosition = 'center';
    } else {
      particle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    }

    document.body.appendChild(particle);

    // Force reflow
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    particle.offsetWidth;

    const deltaX = endX - startX;
    const deltaY = endY - startY;

    particle.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.35)`;
    particle.style.opacity = '0.7';

    let executed = false;
    const finish = () => {
      if (executed) return;
      executed = true;
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
      cartBtn.classList.remove('cart-bounce-pulse');
      // Force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      cartBtn.offsetWidth;
      cartBtn.classList.add('cart-bounce-pulse');

      action();
    };

    particle.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 450);
  };

  // Helper to render an individual item card
  const renderItemCard = (item: MenuItem) => {
    const isAvailable = hasSelectedBranch
      ? ((item.branchAvailability && item.branchAvailability[currentBranchId] !== undefined)
          ? Boolean(item.branchAvailability[currentBranchId])
          : (item.isAvailable ?? true))
      : (item.isAvailable ?? true);
    const rawPrice = hasSelectedBranch
      ? (item.branchPriceOverrides?.[currentBranchId] ?? item.basePrice)
      : getItemMinPrice(item);
    const displayPrice = Number(rawPrice) || 0;

    // Check if item is already in cart for this order
    const cartItem = cart.find((c) => c.menuItemId === item.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;

    return (
      <div
        key={item.id}
        id={`menu-item-${item.id}`}
        data-category={item.category}
        className="foodies-dish-card"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: isAvailable ? '1px solid var(--border-color)' : '1px dashed var(--border-color)',
          overflow: 'hidden',
          boxShadow: isAvailable ? 'var(--shadow-md)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          cursor: isAvailable ? 'default' : 'pointer',
          opacity: isAvailable ? 1 : 0.6,
          filter: isAvailable ? 'none' : 'grayscale(70%)',
          position: 'relative',
        }}
        onClick={!isAvailable ? () => setBranchUnavailableModal({
          visible: true,
          branchName: currentBranch?.name || 'this branch',
          itemNames: [item.name],
        }) : undefined}
      >
        {/* Photo & Category Badge */}
        <div className="dish-img-wrap" style={{ height: '190px', width: '100%', position: 'relative', overflow: 'hidden', backgroundColor: '#F8FAFC' }}>
          {resolveDishImage(item.image, item.category, item.id, item.name) ? (
            <img
              src={resolveDishImage(item.image, item.category, item.id, item.name)}
              loading="lazy"
              decoding="async"
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/food-biryani.jpg';
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Utensils size={42} style={{ opacity: 0.35 }} />
            </div>
          )}
          <span
            className="dish-cat-badge"
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(6px)',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {item.category}
          </span>

          {/* Unavailable Badge */}
          {!isAvailable && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  letterSpacing: '0.04em',
                }}
              >
                UNAVAILABLE IN THIS BRANCH
              </span>
            </div>
          )}
        </div>

        {/* Item Info */}
        <div className="dish-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <h3 className="dish-title" style={{ fontSize: 'clamp(13px, 1.8vw, 16px)', fontWeight: 700, color: 'var(--text-main)', margin: 0, lineHeight: 1.25 }}>
            {item.name}
          </h3>
          <p
            className="dish-desc"
            style={{
              fontSize: 'clamp(11.5px, 1.4vw, 13px)',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.description}
          </p>

          {/* Pricing & Add/Quantity Controller Row (In same row below name) */}
          <div
            className="dish-action-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 'auto',
              paddingTop: '8px',
              gap: '4px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div className="dish-price-block">
              <span className="dish-price-label" style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>
                Price (Cash)
              </span>
              <span className="dish-price" style={{ fontSize: 'clamp(12px, 1.8vw, 17px)', fontWeight: 800, color: 'var(--primary)', whiteSpace: 'nowrap', lineHeight: 1 }}>
                Rs. {displayPrice.toLocaleString()}
              </span>
            </div>

            {/* When not in cart: display "+ Add" button (desktop) / "Order" (mobile). When selected: order option appears as delete sign, quantity, plus sign */}
            {inCartQty === 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isAvailable) {
                    setBranchUnavailableModal({
                      visible: true,
                      branchName: currentBranch?.name || 'this branch',
                      itemNames: [item.name],
                    });
                    return;
                  }
                  triggerFlyToCart(e, () => {
                    addToCart({
                      id: `cart-${item.id}-${Date.now()}`,
                      menuItemId: item.id,
                      name: item.name,
                      unitPrice: displayPrice,
                      quantity: 1,
                      size: item.sizes?.[0]?.name || 'Standard',
                    });
                  }, item.image);
                }}
                className="dish-order-btn"
                style={{
                  height: '32px',
                  width: '96px',
                  boxSizing: 'border-box',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isAvailable ? 'var(--primary)' : '#FEE2E2',
                  color: isAvailable ? '#FFFFFF' : '#DC2626',
                  fontSize: 'clamp(11px, 1.5vw, 13px)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: isAvailable ? '0 4px 10px var(--primary-glow)' : 'none',
                  border: isAvailable ? 'none' : '1px solid #FCA5A5',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {isAvailable ? (
                  <>
                    <Plus size={13} className="dish-btn-icon" />
                    <span>Order</span>
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: 'clamp(10px, 1.3vw, 11px)',
                      fontWeight: 750,
                      color: '#DC2626',
                      lineHeight: 1,
                      letterSpacing: '0.01em',
                    }}
                  >
                    Unavailable
                  </span>
                )}
              </button>
            ) : (
              <div
                className="dish-qty-stepper"
                onClick={(e) => e.stopPropagation()}
                style={{
                  height: '32px',
                  width: '96px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '2px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1.5px solid var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2px 4px',
                  boxShadow: '0 2px 8px var(--primary-glow)',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (cartItem) {
                      updateCartItemQty(cartItem.id, -1);
                    }
                  }}
                  className="dish-stepper-btn dish-stepper-dec"
                  aria-label={inCartQty === 1 ? 'Remove from cart' : 'Decrease quantity'}
                  title={inCartQty === 1 ? 'Remove from cart' : 'Decrease quantity'}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '5px',
                    backgroundColor: inCartQty === 1 ? '#FEF2F2' : '#FFFFFF',
                    border: inCartQty === 1 ? '1px solid #FCA5A5' : '1px solid var(--border-color)',
                    color: inCartQty === 1 ? '#DC2626' : 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 800,
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {inCartQty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                </button>

                <span
                  className="dish-qty-val"
                  style={{
                    fontSize: 'clamp(11px, 1.5vw, 13px)',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    flex: 1,
                    textAlign: 'center',
                    userSelect: 'none',
                    lineHeight: 1,
                  }}
                >
                  {inCartQty}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (cartItem) {
                      triggerFlyToCart(e, () => {
                        updateCartItemQty(cartItem.id, 1);
                      }, item.image);
                    }
                  }}
                  className="dish-stepper-btn dish-stepper-inc"
                  aria-label="Increase quantity"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 800,
                    boxShadow: '0 2px 6px var(--primary-glow)',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const menuBottomPadding = cartCount > 0 ? '80px' : '20px';

  return (
    <div
      className={`foodies-menu-container ${isCheckoutMode ? 'checkout-active' : ''}`}
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        // Longhands only: mixing the `padding` shorthand with `paddingTop` let React drop the
        // top padding when the bottom padding changed (cart bar appearing).
        paddingTop: isCheckoutMode ? '20px' : '0px',
        paddingRight: '16px',
        paddingBottom: menuBottomPadding,
        paddingLeft: '16px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Category Filters Bar & Search Box: FULL LINE directly below the 72px fixed header (tight spacing) - Hidden in Checkout Mode */}
      {!isCheckoutMode && (
        <div
          className="foodies-category-bar-full-line"
          style={{
            position: 'sticky',
            top: '72px', // In line with customer header bottom
            zIndex: 900,
            backgroundColor: 'var(--bg-main)',
            padding: '6px 0 8px',
            marginTop: 0,
            marginBottom: '14px',
            borderBottom: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            width: '100%',
          }}
        >
          <div
            className="foodies-menu-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              width: '100%',
            }}
          >
          {/* Scrollable Category Filter Pills */}
          <div
            ref={categoryRowRef}
            className="foodies-menu-chips"
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
              padding: '2px 0',
              flex: '1 1 auto',
              minWidth: 0,
            }}
          >
            {categories.map((cat: string) => (
              <button
                key={cat}
                ref={(el) => {
                  categoryBtnRefs.current[cat] = el;
                }}
                onClick={() => handleCategoryClick(cat)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-card)',
                  color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                  border: selectedCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  fontSize: '13px',
                  fontWeight: selectedCategory === cat ? 700 : 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  boxShadow: selectedCategory === cat ? '0 4px 10px var(--primary-glow)' : 'var(--shadow-sm)',
                  transition: 'all 0.18s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0,
                }}
              >
                <Flame size={14} />
                <span>{cat}</span>
              </button>
            ))}
          </div>

          {/* Menu Search Box (Right Side of Category Bar) — Hidden in Table QR mode */}
          {!isTableQr ? (
            <div
              className="foodies-menu-search-box"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-card)',
                border: '1.5px solid var(--border-color)',
                borderRadius: 'var(--radius-full)',
                padding: '7px 14px',
                width: '260px',
                minWidth: '200px',
                flexShrink: 0,
                boxShadow: 'var(--shadow-sm)',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
            >
              <Search size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                placeholder="Search dishes..."
                style={{
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '13px',
                  color: 'var(--text-main)',
                  width: '100%',
                  fontFamily: 'inherit',
                  fontWeight: 650,
                  padding: 0,
                }}
              />
              {menuSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMenuSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(194, 65, 12, 0.08)',
                border: '1.5px solid rgba(194, 65, 12, 0.25)',
                borderRadius: 'var(--radius-full)',
                padding: '7px 14px',
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
            >
              <Utensils size={15} color="#C2410C" />
              <span style={{ fontSize: '13px', fontWeight: 850, color: '#C2410C' }}>
                Dine-In • Table {tableFromUrl || selectedTableNumber} Assigned
              </span>
            </div>
          )}
        </div>
      </div>
      )}

      {isTableQr && qrGeo.status !== 'inside' && (
        <div
          role="status"
          style={{
            margin: '12px 0',
            padding: '12px 16px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            backgroundColor: qrGeo.status === 'checking' || qrGeo.status === 'idle' ? '#FFF7ED' : '#FEF2F2',
            border: `1.5px solid ${qrGeo.status === 'checking' || qrGeo.status === 'idle' ? '#FED7AA' : '#FCA5A5'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 750, color: qrGeo.status === 'checking' || qrGeo.status === 'idle' ? '#9A3412' : '#991B1B' }}>
            <MapPin size={16} />
            <span>
              {qrGeo.status === 'checking' || qrGeo.status === 'idle'
                ? `Checking you are at ${currentBranch?.name || 'the cafe'}…`
                : qrGeo.status === 'outside'
                ? `You are ${qrGeo.distance !== null && qrGeo.distance >= 1000 ? `${(qrGeo.distance / 1000).toFixed(1)} km` : `${qrGeo.distance} m`} away. Table QR orders work only within ${qrRadiusMeters} m of ${currentBranch?.name || 'the branch'}.`
                : qrGeo.message || 'Location is required to order from this table.'}
            </span>
          </div>
          {qrGeo.status !== 'checking' && qrGeo.status !== 'idle' && (
            <button
              type="button"
              onClick={() => void checkQrLocation(true)}
              style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#DC2626', color: '#FFFFFF', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
            >
              Check again
            </button>
          )}
        </div>
      )}

      {/* Two-Column Layout Below Categories: Dishes on Left, Static Checkout Card on Right */}
      <div className="foodies-menu-main-layout" style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', width: '100%' }}>
        {/* Left Column: Menu Dishes or Checkout Order Review */}
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          {isCheckoutMode ? (
            /* ================= CHECKOUT MODE LEFT COLUMN ================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Selected Items Card */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  padding: '24px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px',
                    paddingBottom: '16px',
                    borderBottom: '1.5px solid var(--border-color)',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setIsCheckoutMode(false)}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1.5px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-main)',
                        transition: 'all 0.15s ease',
                        boxShadow: 'var(--shadow-sm)',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.color = 'var(--primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-card-subtle)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.color = 'var(--text-main)';
                      }}
                      title="Back to Menu"
                      aria-label="Back to Menu"
                    >
                      <ArrowLeft size={19} />
                    </button>
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '20px',
                          fontWeight: 900,
                          color: 'var(--text-main)',
                          fontFamily: 'Outfit, sans-serif',
                        }}
                      >
                        Your Selected Items
                      </h2>
                      <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {cartCount} {cartCount === 1 ? 'item' : 'items'} in your order
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCheckoutMode(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--primary)',
                      backgroundColor: 'transparent',
                      color: 'var(--primary)',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Plus size={15} />
                    <span>Add More Items</span>
                  </button>
                </div>

                {/* List of Cart Items: Displays 3 items, scrollable if > 3 items */}
                <div
                  className="checkout-selected-items-scroll"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    maxHeight: cart.length > 3 ? '292px' : 'none',
                    overflowY: cart.length > 3 ? 'auto' : 'visible',
                    paddingRight: cart.length > 3 ? '6px' : '0px',
                    scrollbarWidth: 'thin',
                  }}
                >
                  {cart.map((item) => {
                    const itemMenuData = menuItems.find((m) => m.id === item.menuItemId);
                    const itemImg = resolveDishImage(itemMenuData?.image, itemMenuData?.category, item.menuItemId, item.name);
                    return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '14px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        gap: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                        <img
                          src={itemImg}
                          alt={item.name}
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '10px',
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/food-biryani.jpg';
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '15px',
                              fontWeight: 850,
                              color: 'var(--text-main)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.name}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 650 }}>
                            Rs. {item.unitPrice.toLocaleString()} each
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                        {/* Quantity Controller */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => updateCartItemQty(item.id, -1)}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              backgroundColor: item.quantity === 1 ? '#FEF2F2' : 'var(--bg-card)',
                              border: item.quantity === 1 ? '1px solid #FCA5A5' : '1px solid var(--border-color)',
                              color: item.quantity === 1 ? '#DC2626' : 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                          </button>
                          <span style={{ fontSize: '14px', fontWeight: 900, minWidth: '20px', textAlign: 'center', color: 'var(--text-main)' }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartItemQty(item.id, 1)}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--primary)',
                              border: 'none',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* Line Total */}
                        <div style={{ minWidth: '85px', textAlign: 'right', fontSize: '15px', fontWeight: 900, color: 'var(--primary)' }}>
                          Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>

                {/* You May Also Like Section (In a row below the selected items) */}
                {youMayAlsoLikeItems.length > 0 && (
                  <div
                    style={{
                      marginTop: '24px',
                      paddingTop: '20px',
                      borderTop: '1.5px solid var(--border-color)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <Sparkles size={18} color="var(--primary)" />
                      <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                        You May Also Like
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>• Popular additions</span>
                    </div>

                    <div
                      className="you-may-also-like-row"
                      ref={youMayLikeRowRef}
                      onPointerDown={handleYouMayLikePointerDown}
                      onPointerMove={handleYouMayLikePointerMove}
                      onPointerUp={handleYouMayLikePointerUp}
                      onPointerCancel={handleYouMayLikePointerUp}
                      onWheel={(e) => {
                        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                          window.scrollBy({ top: e.deltaY, behavior: 'auto' });
                        }
                      }}
                      style={{
                        display: 'flex',
                        gap: '14px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        paddingBottom: '10px',
                        scrollbarWidth: 'thin',
                        touchAction: 'pan-y pan-x',
                        WebkitOverflowScrolling: 'touch',
                        overscrollBehaviorX: 'contain',
                        overscrollBehaviorY: 'auto',
                      }}
                    >
                      {youMayAlsoLikeItems.map((rec) => {
                        const recPrice = (currentBranch && rec.branchPriceOverrides?.[currentBranch.id]) || rec.basePrice;
                        return (
                        <div
                          key={rec.id}
                          style={{
                            width: '180px',
                            flexShrink: 0,
                            borderRadius: '14px',
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          <img
                            src={resolveDishImage(rec.image, rec.category, rec.id, rec.name)}
                            alt={rec.name}
                            style={{ width: '100%', height: '105px', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/food-biryani.jpg';
                            }}
                          />
                          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, justifyContent: 'space-between' }}>
                            <div>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 800,
                                  color: 'var(--text-main)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {rec.name}
                              </div>
                              <div style={{ fontSize: '12.5px', fontWeight: 900, color: 'var(--primary)', marginTop: '2px' }}>
                                Rs. {recPrice.toLocaleString()}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                addToCart({
                                  id: `cart-${rec.id}-${Date.now()}`,
                                  menuItemId: rec.id,
                                  name: rec.name,
                                  unitPrice: recPrice,
                                  quantity: 1,
                                  size: rec.sizes?.[0]?.name || 'Standard',
                                });
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--primary)',
                                border: 'none',
                                color: '#FFFFFF',
                                fontSize: '12px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                              }}
                            >
                              <Plus size={13} />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : searchQuery.trim().length > 0 ? (
            /* Search Query Mode: flat grid of results */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                  Showing <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'item' : 'items'} matching &ldquo;{searchQuery}&rdquo;
                </div>
                <button
                  onClick={() => setMenuSearchQuery('')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary)',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Clear Search
                </button>
              </div>
              {filteredItems.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--border-color)',
                  }}
                >
                  <UtensilsCrossed size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                    No dishes found
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                    Try searching for something else or browse our categories above.
                  </p>
                </div>
              ) : (
                <div className="foodies-menu-grid">
                  {filteredItems.map((item) => renderItemCard(item))}
                </div>
              )}
            </div>
          ) : (
            /* Default Mode: Category Sections for ScrollSpy */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
              {categories.map((cat: string) => {
                  const catItems = allMenuItems.filter((i) => isItemInCategory(i.category, cat));
                  if (catItems.length === 0) return null;

                  return (
                    <section
                      key={cat}
                      id={`cat-section-${encodeURIComponent(cat)}`}
                      style={{
                        scrollMarginTop: '128px',
                      }}
                    >
                      {/* Category Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingBottom: '12px',
                          marginBottom: '20px',
                          borderBottom: '2px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--primary-glow)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Flame size={18} />
                          </span>
                          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                            {cat}
                          </h2>
                        </div>

                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg-card-subtle)',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {catItems.length} {catItems.length === 1 ? 'Dish' : 'Dishes'}
                        </span>
                      </div>

                      {/* Grid of Dishes (3 items per row on desktop) */}
                      <div className="foodies-menu-grid">
                        {catItems.map((item) => renderItemCard(item))}
                      </div>
                    </section>
                  );
                })}
            </div>
          )}
        </div>

        {/* Right Column: Full Static Checkout Card below the category line (Fixed 380px width) */}
        <div
          className="desktop-checkout-column"
          style={{
            width: '380px',
            minWidth: '380px',
            maxWidth: '380px',
            flexShrink: 0,
            position: 'sticky',
            top: isCheckoutMode ? '88px' : '126px', // In checkout mode aligns directly below 72px fixed header
            zIndex: 850,
          }}
        >
          {isCheckoutMode ? (
            orderType === 'dine_in' && checkoutRightStep === 'table' ? (
              /* ================= DINE-IN TABLE SELECTION CARD (Fixed 560px height & 380px width) ================= */
              <div
                style={{
                  width: '100%',
                  height: '560px',
                  minHeight: '560px',
                  maxHeight: '560px',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '20px',
                  border: '1.5px solid var(--border-color)',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Header (Pinned) */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '10px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(217, 101, 40, 0.1)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <UtensilsCrossed size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.01em' }}>
                        Select Dine-In Table
                      </h3>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        {currentBranch?.name || 'Gulberg Flagship'} • Table Service
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isCustomerLoggedIn) {
                        setLoginModalOpen(true);
                        return;
                      }
                      setOrderTypeModalOpen(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '12px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    Change Type
                  </button>
                </div>

                {/* Body (Scrollable, flex: 1) */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {/* Floor Switcher Strip */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                      Select Floor
                    </div>
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {availableFloors.map((fl) => {
                        const isAct = selectedFloor === fl;
                        const shortName = fl.split('(')[0].trim();
                        return (
                          <button
                            key={fl}
                            type="button"
                            onClick={() => setSelectedFloor(fl)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '20px',
                              border: isAct ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: isAct ? 'var(--primary)' : 'var(--bg-card-subtle)',
                              color: isAct ? '#FFFFFF' : 'var(--text-main)',
                              fontSize: '12px',
                              fontWeight: isAct ? 800 : 650,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease',
                              boxShadow: isAct ? '0 2px 8px var(--primary-glow)' : 'none',
                            }}
                          >
                            {shortName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Table Cards Grid */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Tables on {selectedFloor.split('(')[0].trim()} ({floorTables.length})
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Tap to select
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '10px',
                        maxHeight: '230px',
                        overflowY: 'auto',
                        padding: '2px',
                      }}
                    >
                      {floorTables.map((t) => {
                        const isSel = selectedTableNumber === t.number || selectedTableNumber === t.number.replace(/\D/g, '');
                        const isOccupied = t.status === 'occupied';

                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedTableNumber(t.number);
                            }}
                            style={{
                              padding: '12px 10px',
                              borderRadius: '12px',
                              border: isSel
                                ? '2px solid var(--primary)'
                                : '1.5px solid var(--border-color)',
                              backgroundColor: isSel
                                ? 'rgba(217, 101, 40, 0.08)'
                                : 'var(--bg-card)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              position: 'relative',
                              boxShadow: isSel ? '0 3px 12px var(--primary-glow)' : 'var(--shadow-sm)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13.5px', fontWeight: 850, color: isSel ? 'var(--primary)' : 'var(--text-main)' }}>
                                Table {t.number}
                              </span>
                              {isSel && (
                                <span
                                  style={{
                                    backgroundColor: 'var(--primary)',
                                    color: '#FFFFFF',
                                    borderRadius: '50%',
                                    width: '18px',
                                    height: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    fontWeight: 900,
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 650 }}>
                              🪑 {t.capacity || t.chairs || 4} Seats
                            </div>

                            <div style={{ marginTop: '2px' }}>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 750,
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  backgroundColor: isOccupied ? '#FEE2E2' : '#DCFCE7',
                                  color: isOccupied ? '#B91C1C' : '#15803D',
                                  display: 'inline-block',
                                }}
                              >
                                {isOccupied ? '🔴 Occupied' : '🟢 Available'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Table Summary Banner */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px',
                      color: 'var(--text-main)',
                      fontWeight: 750,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '15px' }}>📍</span>
                    <span>
                      Selected: <strong>Table {selectedTableNumber}</strong> ({selectedFloor.split('(')[0].trim()})
                    </span>
                  </div>
                </div>

                {/* Footer (Pinned) */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!isCustomerLoggedIn) {
                        setLoginModalOpen(true);
                        addToast({
                          type: 'warning',
                          title: 'Sign In Required ✉️',
                          message: 'Please sign in to your customer account to proceed.',
                        });
                        return;
                      }
                      setCheckoutRightStep('bill');
                      addToast({
                        type: 'success',
                        title: 'Table Selected',
                        message: `Table #${selectedTableNumber} assigned to your dine-in order.`,
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '13px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 850,
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px var(--primary-glow)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Confirm Table & View Bill ➔</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ================= PAYMENT INFO PAGE / CARD (Fixed 560px height & 380px width) ================= */
              <div
                style={{
                  width: '100%',
                  height: '560px',
                  minHeight: '560px',
                  maxHeight: '560px',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '20px',
                  border: '1.5px solid var(--border-color)',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* 1. Header: Delivery / Order Type Selected at Top (Pinned) */}
                <div
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(217, 101, 40, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {orderType === 'dine_in' ? (
                        <UtensilsCrossed size={17} />
                      ) : orderType === 'takeaway' ? (
                        <ShoppingBag size={17} />
                      ) : (
                        <Bike size={17} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 850, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                        {orderType === 'dine_in' ? '🍽️ Dine-In' : orderType === 'takeaway' ? '🛍️ Takeaway' : '🛵 Delivery'}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          fontWeight: 650,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '1px',
                        }}
                      >
                        {orderType === 'dine_in'
                          ? `Table #${selectedTableNumber} • ${selectedFloor.split('(')[0].trim()}`
                          : orderType === 'takeaway'
                          ? (currentBranch?.name || 'Gulberg Branch')
                          : deliveryAddress}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {orderType === 'dine_in' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isCustomerLoggedIn) {
                            setLoginModalOpen(true);
                            return;
                          }
                          setCheckoutRightStep('table');
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid var(--primary-border)',
                          borderRadius: '6px',
                          color: 'var(--primary)',
                          fontSize: '11px',
                          fontWeight: 750,
                          cursor: 'pointer',
                          padding: '3px 8px',
                          backgroundColor: 'var(--primary-light)',
                        }}
                      >
                        Table
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!isCustomerLoggedIn) {
                          setLoginModalOpen(true);
                          return;
                        }
                        setOrderTypeModalOpen(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        padding: '4px 6px',
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Middle Content: Scrollable Body (flex: 1) */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {/* 2. Total Bill with Info */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 650 }}>
                      <span>Items Subtotal</span>
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>Rs. {cartSubtotal.toLocaleString()}</span>
                    </div>
                    {orderType === 'delivery' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 650 }}>
                        <span>Delivery Fee</span>
                        <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>Rs. {deliveryFee.toLocaleString()}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 650 }}>
                      <span>GST (16%)</span>
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>Rs. {tax.toLocaleString()}</span>
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 850, color: 'var(--text-main)' }}>Total Bill</span>
                      <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif' }}>
                        Rs. {grandTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* 3. Special Instructions */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Special Cooking / Delivery Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder="e.g. less spicy, extra napkins, contact-free handover..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        fontSize: '12.5px',
                        color: 'var(--text-main)',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        resize: 'none',
                      }}
                    />
                  </div>

                  {/* 4. Customer Name (Required) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Customer Name <span style={{ color: 'var(--primary)' }}>*</span>
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        padding: '0 12px',
                      }}
                    >
                      <User size={15} color="var(--primary)" />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Shahwaiz Akram"
                        style={{
                          flex: 1,
                          padding: '10px 0',
                          border: 'none',
                          backgroundColor: 'transparent',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* 5. Receiver Mobile Number (Required) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Receiver Mobile Number <span style={{ color: 'var(--primary)' }}>*</span>
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '10px',
                        border: '1.5px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          padding: '0 10px',
                          fontSize: '12.5px',
                          fontWeight: 750,
                          color: 'var(--text-secondary)',
                          borderRight: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card-subtle)',
                          lineHeight: '38px',
                        }}
                      >
                        🇵🇰 +92
                      </span>
                      <input
                        type="tel"
                        value={customerPhone.replace(/^(\+92|0)/, '')}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="300 1234567"
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Footer: Button to Pay Cash (Pinned) */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!isCustomerLoggedIn) {
                        setLoginModalOpen(true);
                        addToast({
                          type: 'warning',
                          title: 'Sign In Required ✉️',
                          message: 'Please sign in to your customer account to place and pay for your order.',
                        });
                        return;
                      }
                      if (!customerName.trim()) {
                        addToast({
                          type: 'warning',
                          title: 'Customer Name Required',
                          message: 'Please enter your name for this order.',
                        });
                        return;
                      }
                      const cleanDigits = customerPhone.replace(/\D/g, '');
                      if (!cleanDigits || cleanDigits.length < 9) {
                        addToast({
                          type: 'warning',
                          title: 'Receiver Mobile Number Required 📱',
                          message: 'Please provide a valid receiver mobile number.',
                        });
                        return;
                      }
                      setConfirmModalOpen(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 850,
                      fontSize: '14.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px var(--primary-glow)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Banknote size={18} />
                    <span>Pay Cash (Rs. {grandTotal.toLocaleString()})</span>
                  </button>
                </div>
              </div>
            )
          ) : (
          <div
            className="desktop-static-checkout"
            style={{
              width: '100%',
              height: '560px',
              minHeight: '560px',
              maxHeight: '560px',
              boxSizing: 'border-box',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              border: '1.5px solid var(--border-color)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
          {/* Card Header (Fixed) */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-card-subtle)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShoppingBag size={18} />
              </div>
              <div>
                <span style={{ fontWeight: 850, fontSize: '15px', color: 'var(--text-main)', display: 'block', lineHeight: 1.2 }}>
                  My Order
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Foodies Cafe
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 850,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: cartCount > 0 ? 'var(--primary)' : 'var(--bg-card)',
                color: cartCount > 0 ? '#FFFFFF' : 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              {cartCount > 0 ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Empty'}
            </span>
          </div>

          {/* Card Body: Selected Items List (Empty state when 0 items, scrollable list when items added) */}
          <div
            style={{
              padding: '14px 16px',
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', margin: 'auto 0' }}>
                <ShoppingBag size={34} style={{ margin: '0 auto 8px', opacity: 0.35 }} />
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Your order is empty
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Click &ldquo;+ Add&rdquo; on any dish to start your order.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    gap: '10px',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 800, marginTop: '2px' }}>
                      Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                    </div>
                  </div>

                  {/* Quantity Controller: Minus replaced with Trash2 delete sign when quantity is 1 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => updateCartItemQty(item.id, -1)}
                      aria-label={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}
                      title={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: item.quantity === 1 ? '#FEF2F2' : 'var(--bg-card)',
                        border: item.quantity === 1 ? '1px solid #FCA5A5' : '1px solid var(--border-color)',
                        color: item.quantity === 1 ? '#DC2626' : 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontWeight: 800,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {item.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 850, minWidth: '18px', textAlign: 'center', color: 'var(--text-main)' }}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartItemQty(item.id, 1)}
                      aria-label="Increase quantity"
                      title="Increase quantity"
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--primary)',
                        border: 'none',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontWeight: 800,
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Static Bottom Line (Pinned to bottom of card, always visible) */}
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Total Payable:
              </span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>
                Rs. {cartSubtotal.toLocaleString()}
              </span>
            </div>

            {/* Minimum Delivery Warning Notice: appears when delivery is active and cartSubtotal < minDeliveryAmount */}
            {isBelowMinDelivery && (
              <div
                style={{
                  backgroundColor: '#FEF3C7',
                  border: '1.5px solid #F59E0B',
                  borderRadius: 'var(--radius-md)',
                  padding: '9px 12px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
                  boxSizing: 'border-box',
                }}
              >
                <AlertTriangle size={17} color="#D97706" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: '11.5px', color: '#92400E', lineHeight: 1.35, fontWeight: 700 }}>
                  <span>Min delivery order is <strong>Rs. {minDeliveryAmount.toLocaleString()}</strong>.</span>
                  <div style={{ color: '#B45309', fontWeight: 850, marginTop: '1px' }}>
                    Select <strong>Rs. {deliveryShortfall.toLocaleString()}</strong> more to proceed.
                  </div>
                </div>
              </div>
            )}

            {/* Static Checkout Clickable Button */}
            <button
              type="button"
              disabled={cartCount === 0 || isBelowMinDelivery}
              onClick={handleProceedClick}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: cartCount === 0
                  ? 'var(--bg-card-subtle)'
                  : isBelowMinDelivery
                  ? '#FEF3C7'
                  : 'var(--primary)',
                color: cartCount === 0
                  ? 'var(--text-muted)'
                  : isBelowMinDelivery
                  ? '#92400E'
                  : '#FFFFFF',
                border: isBelowMinDelivery ? '1.5px solid #F59E0B' : 'none',
                fontWeight: 850,
                fontSize: '13px',
                cursor: cartCount === 0 || isBelowMinDelivery ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: cartCount > 0 && !isBelowMinDelivery ? '0 4px 14px var(--primary-glow)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>
                {isBelowMinDelivery
                  ? `Select Rs. ${deliveryShortfall.toLocaleString()} More for Delivery`
                  : 'Proceed to Checkout'}
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        )}
      </div>
    </div>

      {/* Mobile Floating Checkout Line Bar (Appears when item is selected on mobile) */}
      {cartCount > 0 && !isCheckoutMode && (
        <div
          className="foodies-mobile-checkout-bar"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            backgroundColor: 'var(--bg-card)',
            borderTop: '2px solid var(--border-color)',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.14)',
            padding: '12px 16px',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Notification just above mobile checkout button when below delivery minimum */}
          {isBelowMinDelivery && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '12px',
                right: '12px',
                marginBottom: '6px',
                backgroundColor: '#FEF3C7',
                border: '1.5px solid #F59E0B',
                borderRadius: '12px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}
            >
              <AlertTriangle size={15} color="#D97706" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '11.5px', color: '#92400E', fontWeight: 750, flex: 1 }}>
                Min delivery Rs. {minDeliveryAmount.toLocaleString()}. Select <strong>Rs. {deliveryShortfall.toLocaleString()}</strong> more to checkout.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '15px',
                boxShadow: '0 2px 8px var(--primary-glow)',
              }}
            >
              {cartCount}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Total Order</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--primary)' }}>
                Rs. {cartSubtotal.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={cartCount === 0 || isBelowMinDelivery}
            onClick={handleProceedClick}
            style={{
              flex: 1,
              maxWidth: isBelowMinDelivery ? '240px' : '220px',
              padding: '11px 16px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: isBelowMinDelivery ? '#FEF3C7' : 'var(--primary)',
              color: isBelowMinDelivery ? '#92400E' : '#FFFFFF',
              border: isBelowMinDelivery ? '1.5px solid #F59E0B' : 'none',
              fontWeight: 850,
              fontSize: '12px',
              cursor: isBelowMinDelivery ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: isBelowMinDelivery ? 'none' : '0 4px 12px var(--primary-glow)',
            }}
          >
            <span>
              {isBelowMinDelivery
                ? `Select Rs. ${deliveryShortfall.toLocaleString()} More`
                : 'Proceed to Checkout'}
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* 3 Clickable Buttons Pop-up Modal Asking for Order Type */}
      <BranchPickerModal
        isOpen={branchPickerFor !== null}
        orderType={branchPickerFor || 'takeaway'}
        onClose={() => setBranchPickerFor(null)}
        onSelected={() => branchPickerFor && continueAfterBranchPicked(branchPickerFor)}
      />

      {orderTypeModalOpen && (
        <div
          className="foodies-modal-overlay foodies-modal-centered"
          onClick={() => setOrderTypeModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.18s ease-out',
          }}
        >
          <div
            className="foodies-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.25)',
              maxWidth: '520px',
              width: '100%',
              padding: '24px 28px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                Select Order Type
              </h3>
              <button
                type="button"
                onClick={() => setOrderTypeModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* 3 Clickable Option Buttons in One Single Line with Only Type Name */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%' }}>
              <button
                type="button"
                onClick={() => handleSelectOrderType('dine_in')}
                className="order-type-select-btn"
                style={{
                  padding: '16px 8px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  textAlign: 'center',
                  transition: 'all 0.18s ease',
                  boxShadow: 'var(--shadow-sm)',
                  boxSizing: 'border-box',
                }}
              >
                Dine-In
              </button>

              <button
                type="button"
                onClick={() => handleSelectOrderType('takeaway')}
                className="order-type-select-btn"
                style={{
                  padding: '16px 8px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  textAlign: 'center',
                  transition: 'all 0.18s ease',
                  boxShadow: 'var(--shadow-sm)',
                  boxSizing: 'border-box',
                }}
              >
                Takeaway
              </button>

              <button
                type="button"
                onClick={() => handleSelectOrderType('delivery')}
                className="order-type-select-btn"
                style={{
                  padding: '16px 8px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  textAlign: 'center',
                  transition: 'all 0.18s ease',
                  boxShadow: 'var(--shadow-sm)',
                  boxSizing: 'border-box',
                }}
              >
                Delivery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Login Modal: triggered on checkout if user is not signed in first */}
      <CustomerLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={() => {
          setLoginModalOpen(false);
          if (isDesktop) {
            if (!hasConfirmedOrderType) {
              setOrderTypeModalOpen(true);
            } else {
              setIsCheckoutMode(true);
              if (orderType === 'dine_in') {
                setCheckoutRightStep('table');
              } else {
                setCheckoutRightStep('bill');
              }
            }
          } else {
            if (!hasConfirmedOrderType) {
              setOrderTypeModalOpen(true);
            } else if (onProceedToCheckout) {
              onProceedToCheckout();
            } else if (onOpenCart) {
              onOpenCart();
            }
          }
        }}
      />

      {/* Interactive OpenStreetMap Delivery Location Confirmation Modal */}
      <DeliveryMapModal
        isOpen={deliveryMapModalOpen}
        onClose={() => setDeliveryMapModalOpen(false)}
        onConfirmDelivery={handleDeliveryConfirmed}
      />

      {/* Order Price Confirmation Pop-up Modal */}
      {confirmModalOpen && (
        <div
          className="foodies-modal-overlay"
          onClick={() => setConfirmModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.18s ease-out',
          }}
        >
          <div
            className="foodies-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.25)',
              maxWidth: '460px',
              width: '100%',
              padding: '24px 26px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                  Confirm Your Order
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Review your order price and details before submitting
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Prominent Order Price Highlight */}
            <div
              style={{
                padding: '16px 18px',
                borderRadius: '16px',
                backgroundColor: 'rgba(217, 101, 40, 0.08)',
                border: '1.5px solid rgba(217, 101, 40, 0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Order Price
                </span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif', marginTop: '2px' }}>
                  Rs. {grandTotal.toLocaleString()}
                </div>
              </div>
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 850,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Banknote size={14} />
                <span>Pay Cash</span>
              </div>
            </div>

            {/* Order Summary Details */}
            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 650 }}>Order Type</span>
                <span style={{ fontWeight: 800, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                  {orderType === 'dine_in' ? '🍽️ Dine-In' : orderType === 'takeaway' ? '🛍️ Takeaway' : '🛵 Delivery'}
                </span>
              </div>

              {orderType === 'delivery' && (
                <div
                  onClick={() => setDeliveryMapModalOpen(true)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(217, 101, 40, 0.05)',
                  }}
                  title="Click to change delivery location pin"
                >
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 650, flexShrink: 0 }}>Deliver To 📍</span>
                  <span style={{ fontWeight: 750, color: 'var(--primary)', textAlign: 'right', wordBreak: 'break-word', textDecoration: 'underline' }}>
                    {deliveryAddress}
                  </span>
                </div>
              )}

              {orderType === 'dine_in' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 650 }}>Table</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                    Table #{selectedTableNumber}
                  </span>
                </div>
              )}

              {orderType === 'takeaway' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 650 }}>Branch</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                    {currentBranch?.name || 'Gulberg Branch'}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 650 }}>Customer Name</span>
                <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {customerName.trim() || 'Valued Customer'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 650 }}>Receiver Mobile</span>
                <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  🇵🇰 +92 {customerPhone.replace(/^(\+92|0)/, '')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 650 }}>Items Count</span>
                <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </span>
              </div>

              {specialInstructions.trim() && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 650, display: 'block', marginBottom: '2px', fontSize: '12px' }}>
                    Special Instructions
                  </span>
                  <span style={{ color: 'var(--text-main)', fontStyle: 'italic', fontSize: '12.5px' }}>
                    &ldquo;{specialInstructions.trim()}&rdquo;
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  fontWeight: 750,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isCustomerLoggedIn) {
                    setConfirmModalOpen(false);
                    setLoginModalOpen(true);
                    addToast({
                      type: 'warning',
                      title: 'Sign In Required ✉️',
                      message: 'Please sign in to your customer account to place and pay for your order.',
                    });
                    return;
                  }
                  handleConfirmAndPayCash();
                }}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 850,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px var(--primary-glow)',
                }}
              >
                <span>Confirm Order (Rs. {grandTotal.toLocaleString()})</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive styles for progressive layout breakdown */}
      <style jsx global>{`
        .order-type-select-btn:hover {
          border-color: var(--primary) !important;
          background-color: var(--primary-light) !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px var(--primary-glow) !important;
        }
        .foodies-menu-main-layout {
          display: flex;
          gap: 28px;
          align-items: flex-start;
          width: 100%;
        }

        .foodies-menu-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }

        .foodies-mobile-checkout-bar {
          display: none;
        }

        .dish-btn-text-desktop {
          display: inline;
        }

        .dish-btn-text-mobile {
          display: none;
        }

        .foodies-dish-card {
          cursor: default !important;
        }
        .foodies-dish-card:active {
          transform: none !important;
        }
        .dish-order-btn {
          cursor: pointer !important;
          transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease !important;
        }
        .dish-order-btn:active {
          transform: scale(0.92) !important;
          box-shadow: 0 1px 4px var(--primary-glow) !important;
        }
        .dish-stepper-btn {
          cursor: pointer !important;
          transition: transform 0.15s ease, background-color 0.15s ease !important;
        }
        .dish-stepper-btn:active {
          transform: scale(0.90) !important;
        }

        /* 1) Intermediate width (861px - 1200px):
           Remove 3rd card of item (2 items in row) and shrink rest of 2 cards and checkout card */
        @media (max-width: 1200px) and (min-width: 861px) {
          .foodies-menu-main-layout {
            gap: 16px;
          }
          .foodies-menu-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 16px;
          }
          .desktop-checkout-column,
          .desktop-static-checkout {
            width: clamp(260px, 27vw, 320px) !important;
          }
          .foodies-dish-card .dish-content {
            padding: 12px 14px 14px !important;
          }
          .foodies-dish-card .dish-title {
            font-size: 14.5px !important;
          }
          .foodies-dish-card .dish-price {
            font-size: 14.5px !important;
          }
        }

        /* 2) When screen area becomes small (<= 860px):
           Remove checkout card entirely from side, only display the 2 item cards in blank space,
           and start shrinking them as screen boundary touches them.
           Mobile checkout bar appears at the bottom.
           Remove Description / Details, Category badge, and Price(Cash) label so only item name shows,
           with Rs. and + Order aligned in same row. */
        @media (max-width: 860px) {
          .foodies-menu-container {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
          .foodies-category-bar-full-line {
            position: sticky !important;
            top: 72px !important;
            margin-top: 0 !important;
          }
          .desktop-static-checkout {
            display: none !important;
          }
          .foodies-menu-container:not(.checkout-active) .desktop-checkout-column {
            display: none !important;
          }
          .foodies-menu-container.checkout-active .desktop-checkout-column {
            display: block !important;
            width: 100% !important;
            position: static !important;
            margin-top: 20px !important;
          }
          .foodies-menu-main-layout {
            display: block;
          }
          .foodies-menu-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px;
          }
          .foodies-mobile-checkout-bar {
            display: flex !important;
          }
          .foodies-dish-card {
            border-radius: 16px !important;
          }
          .foodies-dish-card .dish-img-wrap {
            height: 105px !important;
            min-height: 105px !important;
            max-height: 105px !important;
          }
          .foodies-dish-card .dish-cat-badge {
            display: none !important;
          }
          .foodies-dish-card .dish-desc {
            display: none !important;
          }
          .foodies-dish-card .dish-price-label {
            display: none !important;
          }
          .foodies-dish-card .dish-content {
            padding: 8px 10px !important;
          }
          .foodies-dish-card .dish-title {
            font-size: 12px !important;
            font-weight: 850 !important;
            line-height: 1.25 !important;
          }
          .foodies-dish-card .dish-action-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            margin-top: auto !important;
            gap: 4px !important;
          }
          .foodies-dish-card .dish-price {
            font-size: 13.5px !important;
            white-space: nowrap !important;
          }
          .dish-order-btn,
          .dish-qty-stepper {
            width: 92px !important;
            height: 30px !important;
            min-width: 92px !important;
            max-width: 92px !important;
            box-sizing: border-box !important;
          }
          .dish-qty-stepper {
            padding: 2px 3px !important;
            gap: 2px !important;
          }
          .dish-stepper-btn {
            width: 22px !important;
            height: 22px !important;
          }
          .dish-qty-val {
            font-size: 12px !important;
            flex: 1 !important;
            text-align: center !important;
          }
        }

        /* 3) Mobile level (<= 640px):
           Remove all extra text from item pic other than name,
           below which there will be price, and in same row to price there will be order.
           When selected, order option appears as delete sign, quantity, plus sign with IDENTICAL box dimensions. */
        @media (max-width: 640px) {
          .foodies-menu-container {
            padding-top: 0 !important;
            margin-top: 0 !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          .foodies-category-bar-full-line {
            position: sticky !important;
            top: 72px !important;
            margin-top: 0 !important;
          }
          .foodies-menu-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }
          .foodies-dish-card {
            border-radius: 16px !important;
          }
          .foodies-dish-card .dish-img-wrap {
            height: 105px !important;
            min-height: 105px !important;
            max-height: 105px !important;
          }
          /* Remove all extra text other than name */
          .foodies-dish-card .dish-cat-badge {
            display: none !important;
          }
          .foodies-dish-card .dish-desc {
            display: none !important;
          }
          .foodies-dish-card .dish-price-label {
            display: none !important;
          }
          .foodies-dish-card .dish-content {
            padding: 8px 10px !important;
            gap: 3px !important;
          }
          .foodies-dish-card .dish-title {
            font-size: 12px !important;
            line-height: 1.25 !important;
            font-weight: 850 !important;
            margin: 0 !important;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .foodies-dish-card .dish-action-row {
            margin-top: auto !important;
            padding-top: 4px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 2px !important;
            flex-wrap: nowrap !important;
          }
          .foodies-dish-card .dish-price {
            font-size: 12px !important;
            font-weight: 850 !important;
            white-space: nowrap !important;
          }
          .dish-btn-text-desktop {
            display: none !important;
          }
          .dish-btn-text-mobile {
            display: inline !important;
          }
          /* Box dimensions remain 100% identical between order button and stepper */
          .dish-order-btn,
          .dish-qty-stepper {
            width: 86px !important;
            height: 28px !important;
            min-width: 86px !important;
            max-width: 86px !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
          }
          .dish-order-btn {
            padding: 0 !important;
            font-size: 11px !important;
            border-radius: 6px !important;
            gap: 2px !important;
          }
          .dish-qty-stepper {
            padding: 2px 3px !important;
            gap: 2px !important;
            border-radius: 6px !important;
          }
          .dish-stepper-btn {
            width: 22px !important;
            height: 22px !important;
            border-radius: 4px !important;
          }
          .dish-stepper-btn svg {
            width: 10px !important;
            height: 10px !important;
          }
          .dish-qty-val {
            font-size: 11.5px !important;
            flex: 1 !important;
            text-align: center !important;
          }
        }

        /* 4) Extra small phones (<= 380px) */
        @media (max-width: 380px) {
          .foodies-menu-container {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
          .foodies-category-bar-full-line {
            position: sticky !important;
            top: 72px !important;
            margin-top: 0 !important;
          }
          .foodies-dish-card .dish-content {
            padding: 5px 6px 6px !important;
          }
          .foodies-dish-card .dish-title {
            font-size: 11px !important;
          }
          .foodies-dish-card .dish-price {
            font-size: 11px !important;
          }
          /* Box dimensions remain 100% identical between order button and stepper */
          .dish-order-btn,
          .dish-qty-stepper {
            width: 78px !important;
            height: 26px !important;
            min-width: 78px !important;
            max-width: 78px !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
          }
          .dish-order-btn {
            padding: 0 !important;
            font-size: 10.5px !important;
            border-radius: 5px !important;
            gap: 1px !important;
          }
          .dish-qty-stepper {
            padding: 1px 2px !important;
            gap: 1px !important;
            border-radius: 5px !important;
          }
          .dish-stepper-btn {
            width: 19px !important;
            height: 19px !important;
            border-radius: 3px !important;
          }
          .dish-stepper-btn svg {
            width: 9px !important;
            height: 9px !important;
          }
          .dish-qty-val {
            font-size: 10.5px !important;
            flex: 1 !important;
            text-align: center !important;
          }
        }

        /* Phones: search on its own full-width row, category chips scroll underneath.
           (This rule used to sit inside the unclosed <=380px block, so it never applied at normal phone widths.) */
        @media (max-width: 640px) {
          .foodies-menu-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
            padding: 0 10px !important;
          }
          .foodies-menu-search-box {
            width: 100% !important;
            min-width: 0 !important;
            order: -1;
          }
          .foodies-menu-chips {
            padding: 2px 2px 4px !important;
            scroll-padding-inline: 10px;
          }
        }

        @keyframes dishPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(226, 27, 34, 0.7);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(226, 27, 34, 0);
            transform: scale(1.02);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(226, 27, 34, 0);
            transform: scale(1);
          }
        }

        .highlight-target-dish {
          animation: dishPulse 1.2s ease-in-out 2;
          border-color: var(--primary) !important;
        }
      `}</style>
    </div>
  );
};
