import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Branch, MenuItem, Order, Table, MobileUser, AuditLog, Announcement, AppNotification, NotificationSettings, ReceiverNotificationPreferences } from '../types';
import { getSecureAuthToken } from './secureTokenStore';

/**
 * Dynamically resolves the Next.js API Base URL from environment config:
 * 1. Explicit EXPO_PUBLIC_API_URL or app.json extra.apiUrl
 * 2. Web browser: window.location.origin or 'http://localhost:3000'
 * 3. Mobile device running Expo Go: detects host machine LAN IP from Metro debuggerHost
 */
export function getApiBaseUrl(): string {
  const envUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    (Constants.expoConfig?.extra as any)?.apiUrl;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (Platform.OS === 'web') {
    return 'https://foodies-cafe-eutsvzksr-aliraza8.vercel.app';
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:3000`;
    }
  }

  return 'https://foodies-cafe-eutsvzksr-aliraza8.vercel.app';
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Normalizes branch IDs to match PostgreSQL database constraints strictly:
 * - 'gulberg-lahore'
 * - 'f7-islamabad'
 * - 'clifton-karachi'
 */
export function normalizeBranchId(id?: string): string {
  if (!id) return 'gulberg-lahore';
  if (id === 'all') return 'all';
  if (id === 'branch-1' || id === 'branch-gulberg' || id.includes('gulberg')) return 'gulberg-lahore';
  if (id === 'branch-2' || id === 'branch-f7' || id.includes('f7') || id.includes('islamabad')) return 'f7-islamabad';
  if (id === 'branch-3' || id === 'branch-clifton' || id.includes('clifton') || id.includes('karachi')) return 'clifton-karachi';
  return id;
}

/**
 * Calculates the lowest/minimum price available for an item across basePrice and all branch overrides
 */
export function getItemMinPrice(item: MenuItem): number {
  let min = Number(item.basePrice) || 0;
  if (item.branchPriceOverrides && typeof item.branchPriceOverrides === 'object') {
    const overrides = Object.values(item.branchPriceOverrides)
      .map((p) => Number(p))
      .filter((p) => !isNaN(p) && p > 0);
    if (overrides.length > 0) {
      min = Math.min(min, ...overrides);
    }
  }
  return min;
}

/**
 * Calculates the effective price for an item:
 * - If a branch is selected: returns that branch's override or basePrice
 * - If no branch is selected: returns the minimum price among all branches
 */
export function getItemEffectivePrice(item: MenuItem, branchId?: string | null): number {
  if (branchId) {
    const override = item.branchPriceOverrides?.[branchId];
    if (override !== undefined && override !== null && !isNaN(Number(override)) && Number(override) > 0) {
      return Number(override);
    }
    return Number(item.basePrice) || 0;
  }
  return getItemMinPrice(item);
}

/**
 * Generic API fetch helper with automatic base URL routing and timeout handling
 */
export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; ok: boolean }> {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;

  try {
    let token: string | null = null;
    try {
      token = await getSecureAuthToken();
    } catch {}

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as any) || {}),
    };

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { data: null, error: errText || `HTTP ${res.status}`, ok: false };
    }

    const data = await res.json().catch(() => null);
    return { data, error: null, ok: true };
  } catch (err: any) {
    return { data: null, error: err.message || 'Network request failed', ok: false };
  }
}

export const SEED_BRANCHES: Branch[] = [
  {
    id: 'gulberg-lahore',
    name: 'Gulberg Branch (Flagship)',
    city: 'Lahore',
    address: '92-B2, Mian Mehmood Ali Kasoori Rd, Gulberg III, Lahore',
    phone: '+92 42 3578 9101',
    openingHours: '11:00 AM - 01:00 AM',
    isOpen: true,
    isBusy: false,
    prepTimeEstimateMin: 20,
    deliveryEnabled: true,
    latitude: 31.5204,
    longitude: 74.3587,
    maxOrderDistanceKm: 50,
    tableQrMaxDistanceMeters: 300,
    minDeliveryAmount: 500,
  },
  {
    id: 'f7-islamabad',
    name: 'F-7 Markaz Branch',
    city: 'Islamabad',
    address: 'Shop 4-B, College Road, F-7 Markaz, Islamabad',
    phone: '+92 51 2654 321',
    openingHours: '12:00 PM - 12:00 AM',
    isOpen: true,
    isBusy: false,
    prepTimeEstimateMin: 25,
    deliveryEnabled: true,
    latitude: 33.7215,
    longitude: 73.0563,
    maxOrderDistanceKm: 50,
    tableQrMaxDistanceMeters: 300,
    minDeliveryAmount: 500,
  },
  {
    id: 'clifton-karachi',
    name: 'Clifton Block 4 Branch',
    city: 'Karachi',
    address: 'Plot 12-C, 26th Street, Block 4, Clifton, Karachi',
    phone: '+92 21 3587 6543',
    openingHours: '01:00 PM - 02:00 AM',
    isOpen: true,
    isBusy: false,
    prepTimeEstimateMin: 25,
    deliveryEnabled: true,
    latitude: 24.8138,
    longitude: 67.0299,
    maxOrderDistanceKm: 50,
    tableQrMaxDistanceMeters: 300,
    minDeliveryAmount: 500,
  },
];

export const SEED_MENU_ITEMS: MenuItem[] = [
  // 1. Biryani & Rice
  {
    id: 'm1',
    name: 'Royal Chicken Dum Biryani',
    category: 'Biryani & Rice',
    description: 'Fragrant long-grain basmati cooked with saffron, marinated chicken, caramelised onions & secret house spices in a sealed copper handi.',
    basePrice: 650,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    branchPriceOverrides: { 'gulberg-lahore': 750, 'f7-islamabad': 620, 'clifton-karachi': 680 },
    sizes: [
      { name: 'Regular (Single)', priceDelta: 0 },
      { name: 'Jumbo (Double)', priceDelta: 350 },
    ],
    extras: [
      { name: 'Extra Zeera Raita', price: 60 },
      { name: 'Fresh Kachumber Salad', price: 70 },
      { name: 'Extra Boiled Egg', price: 50 },
    ],
  },
  {
    id: 'm8',
    name: 'Mutton Special Dum Biryani',
    category: 'Biryani & Rice',
    description: 'Slow-cooked succulent baby mutton pieces layered with aged basmati rice, whole cardamoms, fried onions and saffron steam.',
    basePrice: 950,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    branchPriceOverrides: { 'gulberg-lahore': 1050, 'f7-islamabad': 920, 'clifton-karachi': 990 },
    sizes: [
      { name: 'Single Pot', priceDelta: 0 },
      { name: 'Family Platter (Serves 3)', priceDelta: 850 },
    ],
    extras: [
      { name: 'Extra Zeera Raita', price: 60 },
      { name: 'Fresh Kachumber Salad', price: 70 },
    ],
  },
  {
    id: 'm9',
    name: 'Matka Dum Biryani with Chicken',
    category: 'Biryani & Rice',
    description: 'Traditional earthen clay pot chicken biryani sealed with dough, delivering intense smoky aroma, spiced potatoes and tender chicken.',
    basePrice: 720,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Standard Matka', priceDelta: 0 },
      { name: 'Jumbo Matka', priceDelta: 320 },
    ],
    extras: [
      { name: 'Mint Raita', price: 60 },
      { name: 'Spicy Chutney', price: 50 },
    ],
  },

  // 2. Karahi & Handi
  {
    id: 'm2',
    name: 'Desi Ghee Shinwari Chicken Karahi',
    category: 'Karahi & Handi',
    description: 'Fresh country chicken wok-tossed in pure organic desi ghee, ripe tomatoes, coarse crushed black pepper and ginger juliennes.',
    basePrice: 1250,
    image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    branchPriceOverrides: { 'gulberg-lahore': 1350, 'f7-islamabad': 1180, 'clifton-karachi': 1280 },
    sizes: [
      { name: 'Half (serves 2)', priceDelta: 0 },
      { name: 'Full (serves 4)', priceDelta: 1100 },
    ],
    extras: [
      { name: 'Roghni Naan', price: 80 },
      { name: 'Garlic Butter Naan', price: 110 },
      { name: 'Mint Chutney', price: 50 },
    ],
  },
  {
    id: 'm10',
    name: 'Boneless Chicken Makhni Handi',
    category: 'Karahi & Handi',
    description: 'Velvety smooth tomato cream gravy with tender boneless chicken breast cubes, topped with fresh dairy butter and kasuri methi.',
    basePrice: 1180,
    image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Half (serves 2)', priceDelta: 0 },
      { name: 'Full (serves 4)', priceDelta: 970 },
    ],
    extras: [
      { name: 'Garlic Butter Naan', price: 110 },
      { name: 'Extra Makhni Gravy', price: 150 },
    ],
  },
  {
    id: 'm11',
    name: 'Peshawari Mutton Shinwari Karahi',
    category: 'Karahi & Handi',
    description: 'Prime mutton cuts simmered in pure animal fat and butter with salt, green chilies and fresh tomatoes in a traditional charcoal wok.',
    basePrice: 1850,
    image: 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Half KG (serves 2)', priceDelta: 0 },
      { name: 'Full KG (serves 4)', priceDelta: 1600 },
    ],
    extras: [
      { name: 'Tandoori Roti (2 pcs)', price: 70 },
      { name: 'Roghni Naan', price: 80 },
    ],
  },

  // 3. BBQ & Kebabs
  {
    id: 'm3',
    name: 'Smoky Beef Seekh Kebabs (4 Pcs)',
    category: 'BBQ & Kebabs',
    description: 'Melt-in-mouth prime beef mince seasoned with roasted cumin, brown onion paste, coriander seeds and charcoal grilled over hot embers.',
    basePrice: 780,
    image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Standard (4 pcs)', priceDelta: 0 },
      { name: 'Platter (8 pcs)', priceDelta: 680 },
    ],
    extras: [
      { name: 'Tandoori Paratha', price: 90 },
      { name: 'Mint Coriander Dip', price: 40 },
    ],
  },
  {
    id: 'm12',
    name: 'Charcoal Grilled Chicken Malai Boti',
    category: 'BBQ & Kebabs',
    description: 'Creamy boneless chicken thigh cubes marinated in heavy malai, crushed green chilies, white pepper, and seared over charcoal.',
    basePrice: 820,
    image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Single Skewer (8 pcs)', priceDelta: 0 },
      { name: 'Double Skewer (16 pcs)', priceDelta: 740 },
    ],
    extras: [
      { name: 'Garlic Naan', price: 110 },
      { name: 'Imli Chutney', price: 50 },
    ],
  },
  {
    id: 'm13',
    name: 'Mutton Balochi Chops (3 Pcs)',
    category: 'BBQ & Kebabs',
    description: 'Tender mutton chops marinated in Balochi dried spices, ginger garlic paste and slow grilled till charred and crispy outside.',
    basePrice: 1450,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Standard (3 pcs)', priceDelta: 0 },
      { name: 'Feast (6 pcs)', priceDelta: 1350 },
    ],
    extras: [
      { name: 'Peshawari Chutney', price: 60 },
      { name: 'Roghni Naan', price: 80 },
    ],
  },

  // 4. Burgers & Fast Food
  {
    id: 'm4',
    name: 'The Foodies Crunch Burger',
    category: 'Burgers & Fast Food',
    description: 'Crispy fried buttermilk chicken fillet tossed in spicy glaze, topped with cheddar cheese, tangy coleslaw, garlic aioli on a toasted brioche.',
    basePrice: 620,
    image: 'https://images.unsplash.com/photo-1521305916504-4a1121188589?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Single Fillet', priceDelta: 0 },
      { name: 'Double Monster Fillet', priceDelta: 280 },
    ],
    extras: [
      { name: 'Seasoned Masala Fries', price: 160 },
      { name: 'Cheese Dip Shot', price: 90 },
    ],
  },
  {
    id: 'm14',
    name: 'Double Beef Smashed Cheeseburger',
    category: 'Burgers & Fast Food',
    description: 'Two seared prime beef patties, double melted cheddar, caramelized onions, crisp iceberg lettuce and house secret sauce on potato bun.',
    basePrice: 840,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    branchPriceOverrides: { 'gulberg-lahore': 890, 'f7-islamabad': 790, 'clifton-karachi': 850 },
    sizes: [
      { name: 'Double Patty', priceDelta: 0 },
      { name: 'Triple Monster Patty', priceDelta: 310 },
    ],
    extras: [
      { name: 'Crispy Curly Fries', price: 190 },
      { name: 'Truffle Mayo', price: 80 },
    ],
  },
  {
    id: 'm15',
    name: 'Peri Peri Loaded Crispy Fries',
    category: 'Burgers & Fast Food',
    description: 'Skin-on golden fries smothered with spicy crispy chicken chunks, warm cheddar cheese sauce, garlic ranch and pickled jalapeños.',
    basePrice: 420,
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Regular Box', priceDelta: 0 },
      { name: 'Party Sharing Platter', priceDelta: 340 },
    ],
    extras: [
      { name: 'Extra Cheddar Sauce', price: 80 },
      { name: 'Jalapeño Bombs (4 pcs)', price: 140 },
    ],
  },

  // 5. Tandoor & Breads
  {
    id: 'm5',
    name: 'Fresh Tandoori Roghni Naan',
    category: 'Tandoor & Breads',
    description: 'Soft leavened bread brushed with clarified butter, toasted white sesame seeds and baked against clay tandoor walls.',
    basePrice: 80,
    image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm16',
    name: 'Roasted Garlic Butter Naan',
    category: 'Tandoor & Breads',
    description: 'Fresh clay oven tandoori bread slathered in melted butter, roasted minced garlic, and chopped coriander leaves.',
    basePrice: 110,
    image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm17',
    name: 'Cheese Stuffed Tandoori Naan',
    category: 'Tandoor & Breads',
    description: 'Crispy outside, molten inside! Stuffed with mozzarella & mild cheddar cheese, herbs and brushed with butter.',
    basePrice: 240,
    image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },

  // 6. Beverages & Desserts
  {
    id: 'm6',
    name: 'Traditional Peshawari Qahwa with Cardamom',
    category: 'Beverages & Desserts',
    description: 'Brewed green tea leaves infused with green cardamom pods, cinnamon bark, served with saffron candy crystals.',
    basePrice: 120,
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm7',
    name: 'Shahi Malai Kulfi on Stick',
    category: 'Beverages & Desserts',
    description: 'Dense, creamy frozen dessert made from reduced whole milk, infused with roasted pistachios, almonds, and rose essence.',
    basePrice: 220,
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm18',
    name: 'Artisanal Fresh Mint Margarita',
    category: 'Beverages & Desserts',
    description: 'Fresh mint leaves blended with fresh lime juice, black rock salt, and ice-cold soda. The ultimate refreshing palate cleanser.',
    basePrice: 260,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm19',
    name: 'Special Karak Doodh Patti Chai',
    category: 'Beverages & Desserts',
    description: 'Slow-simmered rich full-cream milk tea brewed with cardamom pods and premium CTC black tea leaves.',
    basePrice: 130,
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm20',
    name: 'Hot Gulab Jamun with Rabri (2 Pcs)',
    category: 'Beverages & Desserts',
    description: 'Soft hot fried dumplings soaked in rose cardamom syrup, served on a chilled bed of thickened pistachio malai rabri.',
    basePrice: 290,
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
];

export const SEED_TABLES: Table[] = [
  { id: 't1', number: 'T-01', branchId: 'gulberg-lahore', capacity: 2, floor: 'Ground Floor (Main Dining)', status: 'available', pin: '4921', assignedWaiterId: 'user-floor', assignedWaiterName: 'Kashif Ali (Floor Staff)' },
  { id: 't2', number: 'T-02', branchId: 'gulberg-lahore', capacity: 4, floor: 'Ground Floor (Main Dining)', status: 'available', pin: '7182', assignedWaiterId: 'user-floor', assignedWaiterName: 'Kashif Ali (Floor Staff)' },
  { id: 't3', number: 'T-03', branchId: 'gulberg-lahore', capacity: 4, floor: 'Ground Floor (Main Dining)', status: 'available', pin: '3941', assignedWaiterId: 'user-floor', assignedWaiterName: 'Kashif Ali (Floor Staff)' },
  { id: 't4', number: 'T-04', branchId: 'gulberg-lahore', capacity: 6, floor: 'Ground Floor (Main Dining)', status: 'available', pin: '8812' },
  { id: 't5', number: 'T-05', branchId: 'gulberg-lahore', capacity: 4, floor: '1st Floor (Family Hall)', status: 'available', pin: '1092' },
  { id: 't6', number: 'T-06', branchId: 'gulberg-lahore', capacity: 8, floor: '1st Floor (Family Hall)', status: 'available', pin: '6523' },
  { id: 't7', number: 'T-07', branchId: 'gulberg-lahore', capacity: 4, floor: 'Rooftop Terrace (Open Air)', status: 'available', pin: '9901' },
  { id: 't8', number: 'T-08', branchId: 'gulberg-lahore', capacity: 2, floor: 'Rooftop Terrace (Open Air)', status: 'available', pin: '2311' },
  { id: 't9', number: 'T-01', branchId: 'f7-islamabad', capacity: 4, floor: 'Ground Floor (Main Dining)', status: 'available', pin: '3312' },
  { id: 't10', number: 'T-02', branchId: 'f7-islamabad', capacity: 6, floor: 'Ground Floor (Main Dining)', status: 'available', pin: '4419' },
  { id: 't11', number: 'T-03', branchId: 'f7-islamabad', capacity: 4, floor: '1st Floor (Family Hall)', status: 'available', pin: '5521' },
  { id: 't12', number: 'T-01', branchId: 'clifton-karachi', capacity: 4, floor: 'Ground Floor (Main Dining)', status: 'available', pin: '6618' },
  { id: 't13', number: 'T-02', branchId: 'clifton-karachi', capacity: 6, floor: 'Rooftop Terrace (Open Air)', status: 'available', pin: '7729' },
];

export const SEED_USERS: MobileUser[] = [
  {
    id: 'user-owner',
    name: 'Malik Jahangir',
    phone: '03001112233',
    email: 'owner@foodiescafe.pk',
    role: 'platform_owner',
    status: 'active',
  },
  {
    id: 'user-bm',
    name: 'Rashid Mehmood (Branch Manager)',
    phone: '03002223344',
    email: 'manager.gulberg@foodiescafe.pk',
    role: 'branch_manager',
    branchId: 'gulberg-lahore',
    status: 'active',
  },
  {
    id: 'user-bm-isb',
    name: 'Noman Bashir (Branch Manager - Islamabad)',
    phone: '03003334455',
    email: 'manager.islamabad@foodiescafe.pk',
    role: 'branch_manager',
    branchId: 'f7-islamabad',
    status: 'active',
  },
  {
    id: 'user-bm-khi',
    name: 'Kamran Siddiqui (Branch Manager - Karachi)',
    phone: '03005556677',
    email: 'manager.karachi@foodiescafe.pk',
    role: 'branch_manager',
    branchId: 'clifton-karachi',
    status: 'active',
  },
  {
    id: 'user-kitchen',
    name: 'Chef Ustaad Aslam (Kitchen - Lahore)',
    phone: '03006667788',
    email: 'kitchen.gulberg@foodiescafe.pk',
    role: 'kitchen_staff',
    branchId: 'gulberg-lahore',
    status: 'active',
  },
  {
    id: 'user-kitchen-isb',
    name: 'Chef Naveed Iqbal (Kitchen - Islamabad)',
    phone: '03006667789',
    email: 'kitchen.f7@foodiescafe.pk',
    role: 'kitchen_staff',
    branchId: 'f7-islamabad',
    status: 'active',
  },
  {
    id: 'user-kitchen-khi',
    name: 'Chef Rashid Mehmood (Kitchen - Karachi)',
    phone: '03006667790',
    email: 'kitchen.karachi@foodiescafe.pk',
    role: 'kitchen_staff',
    branchId: 'clifton-karachi',
    status: 'active',
  },
  {
    id: 'user-floor',
    name: 'Kashif Ali (Floor Staff)',
    phone: '03004445566',
    email: 'floor.gulberg@foodiescafe.pk',
    role: 'floor_staff',
    branchId: 'gulberg-lahore',
    status: 'active',
    assignedFloor: 'Ground Floor',
    assignedTableNumbers: ['T-01', 'T-02', 'T-03'],
  },
  {
    id: 'user-rider-1',
    name: 'Tariq Mehmood',
    phone: '+92 301 9991122',
    email: 'rider1.gulberg@foodiescafe.pk',
    role: 'delivery_staff',
    branchId: 'gulberg-lahore',
    status: 'active',
    riderAvailability: 'available',
    riderTotalDeliveries: 42,
  },
  {
    id: 'user-rider-2',
    name: 'Usman Ghani',
    phone: '+92 302 8882233',
    email: 'rider2.gulberg@foodiescafe.pk',
    role: 'delivery_staff',
    branchId: 'gulberg-lahore',
    status: 'active',
    riderAvailability: 'available',
    riderTotalDeliveries: 18,
  },
  {
    id: 'user-cust',
    name: 'Zeeshan Ahmed',
    phone: '03219876543',
    email: 'zeeshan@example.com',
    role: 'customer',
    status: 'active',
  },
];

export const SEED_ORDERS: Order[] = [];

export const SEED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Midnight Biryani & Karahi Feast: Flat 20% Off',
    tag: 'HOT DEAL',
    description: 'Enjoy 20% off all Mutton & Chicken Karahi orders between 10:00 PM and 2:00 AM across all branches.',
    validUntil: 'Tonight 02:00 AM',
    discountPercent: 20,
    badgeColor: '#EF4444',
  },
  {
    id: 'ann-2',
    title: 'Gulberg Rooftop Terrace Live BBQ Night',
    tag: 'BRANCH SPECIAL',
    description: 'Join us on the Gulberg Rooftop for live open-flame charcoal Seekh Kababs & Mutton Chops every Friday & Saturday.',
    branchId: 'gulberg-lahore',
    branchName: 'Gulberg Lahore',
    validUntil: 'Every Weekend',
    badgeColor: '#F59E0B',
  },
  {
    id: 'ann-3',
    title: 'Free Delivery on Doorstep Orders above Rs. 1500',
    tag: 'ANNOUNCEMENT',
    description: 'Zero delivery fee on all online delivery orders exceeding Rs. 1500 via the mobile app.',
    validUntil: 'Valid this Month',
    badgeColor: '#10B981',
  },
];

export const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-seed-1',
    title: 'Welcome to Foodies Cafe Alerts',
    message: 'Live notifications are active for placed orders, Takeaway pickup counter updates, Dine-In service, and Delivery tracking.',
    type: 'info',
    category: 'system',
    branchId: 'gulberg-lahore',
    senderName: 'Foodies Cafe Operations',
    senderRole: 'system',
    targetRoles: ['all'],
    readBy: [],
    createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
  },
  {
    id: 'notif-seed-2',
    title: 'Takeaway Priority Desk Open',
    message: 'Cashiers & Managers can notify customers directly the moment Takeaway parcels are hot and packed at the counter.',
    type: 'success',
    category: 'takeaway',
    branchId: 'gulberg-lahore',
    orderType: 'takeaway',
    senderName: 'Gulberg Branch Manager',
    senderRole: 'branch_manager',
    targetRoles: ['customer', 'cashier', 'branch_manager', 'kitchen_staff'],
    readBy: [],
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 'notif-seed-3',
    title: 'Peak Dinner Rush Protocol',
    message: 'Kitchen & Riders: Prioritize hot BBQ & Karahi orders and send instant customer updates on dispatch.',
    type: 'warning',
    category: 'staff_alert',
    branchId: 'all',
    senderName: 'Platform Owner',
    senderRole: 'platform_owner',
    targetRoles: ['branch_manager', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff'],
    readBy: [],
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
];

export const SEED_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    actorName: 'Malik Jahangir',
    actorRole: 'platform_owner',
    action: 'price_override',
    details: 'Updated Special Mutton Dum Biryani base price to Rs. 950 across all branches.',
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    actorName: 'Malik Jahangir',
    actorRole: 'platform_owner',
    action: 'table_qr_radius',
    details: 'Configured Gulberg in-store table QR radius to 300 meters.',
  },
];

export const DISH_IMAGE_FALLBACKS: Record<string, string> = {
  'Biryani & Rice': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60',
  'Karahi & Handi': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=60',
  'Burgers': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60',
  'Burgers & Fast Food': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60',
  'BBQ & Kebabs': 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=60',
  'Tandoor & Breads': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=60',
  'Beverages & Desserts': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=60',
  'Desserts': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=60',
  'Beverages': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&auto=format&fit=crop&q=60',
};

export const SPECIFIC_DISH_IMAGES: Record<string, string> = {
  // Burgers & Fast Food
  'm14': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60',
  'm15': 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=800&auto=format&fit=crop&q=60',
  'm4': 'https://images.unsplash.com/photo-1521305916504-4a1121188589?w=800&auto=format&fit=crop&q=60',
  // Biryani & Rice
  'm1': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60',
  'm8': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60',
  'm9': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60',
  // Karahi & Handi
  'm2': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=60',
  'm10': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=60',
  'm11': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800&auto=format&fit=crop&q=60',
  // BBQ & Kebabs
  'm3': 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=60',
  'm12': 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=60',
  'm13': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=60',
  // Tandoor & Breads
  'm5': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=60',
  'm16': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=60',
  'm17': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=60',
  // Beverages & Desserts
  'm6': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=60',
  'm7': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=60',
  'm18': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&auto=format&fit=crop&q=60',
  'm19': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=60',
  'm20': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=60',
};

export function resolveDishImage(image?: string, category?: string, dishIdOrName?: string): string {
  if (image && (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:image/'))) {
    return image;
  }
  if (dishIdOrName && SPECIFIC_DISH_IMAGES[dishIdOrName]) {
    return SPECIFIC_DISH_IMAGES[dishIdOrName];
  }
  if (category && DISH_IMAGE_FALLBACKS[category]) {
    return DISH_IMAGE_FALLBACKS[category];
  }
  return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60';
}

let lastMobileSyncEtag = '';

/**
 * Sync helper: Fetches live data from PostgreSQL via Next.js REST API with ETag + offline seed fallback.
 */
export async function fetchLiveSyncData(
  scope: 'live' | 'full' = 'live',
  branchId?: string,
  customerPhone?: string,
  customerId?: string,
  role: string = 'customer',
  orderIds?: string[]
) {
  const normBranchId =
    role === 'platform_owner' || role === 'kitchen_staff' || branchId === 'all'
      ? 'all'
      : normalizeBranchId(branchId);
  try {
    let url = `/api/sync?scope=${scope}&role=${encodeURIComponent(role)}&branchId=${encodeURIComponent(normBranchId)}&older=true&since=1`;
    if (customerId) url += `&customerId=${encodeURIComponent(customerId)}`;
    if (customerPhone) url += `&customerPhone=${encodeURIComponent(customerPhone)}`;
    if (orderIds && orderIds.length > 0) url += `&orderIds=${encodeURIComponent(orderIds.slice(0, 30).join(','))}`;
    const token = await getSecureAuthToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    if (scope === 'live' && lastMobileSyncEtag) {
      headers['If-None-Match'] = lastMobileSyncEtag;
    }
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}${url}`, {
      headers,
    });
    if (res.status === 304) {
      return null; // Unchanged state (304 Not Modified)
    }
    if (res.ok) {
      const etag = res.headers.get('ETag');
      const d = await res.json();
      if (etag || d?.etag) {
        lastMobileSyncEtag = etag || d.etag;
      }
      const rawMenu = Array.isArray(d.menuItems) && d.menuItems.length ? d.menuItems : (Array.isArray(d.menu) && d.menu.length ? d.menu : SEED_MENU_ITEMS);
      const sanitizedMenu = rawMenu.map((m: MenuItem) => ({
        ...m,
        image: resolveDishImage(m.image, m.category, m.id || m.name),
      }));

      return {
        branches: Array.isArray(d.branches) && d.branches.length ? d.branches : SEED_BRANCHES,
        menuItems: sanitizedMenu,
        categories: Array.isArray(d.categories) ? d.categories : [],
        tables: Array.isArray(d.tables) && d.tables.length ? d.tables : SEED_TABLES,
        orders: Array.isArray(d.orders) ? d.orders : SEED_ORDERS,
        users: Array.isArray(d.users) ? d.users : SEED_USERS,
        refunds: Array.isArray(d.refunds) ? d.refunds : [],
        shifts: Array.isArray(d.shifts) ? d.shifts : [],
        sessions: Array.isArray(d.sessions) ? d.sessions : [],
        footerSettings: d.footerSettings || null,
        announcements: Array.isArray(d.announcements) ? d.announcements : SEED_ANNOUNCEMENTS,
        notifications: Array.isArray(d.notifications) ? d.notifications : SEED_NOTIFICATIONS,
        notificationSettings: d.notificationSettings || null,
        receiverNotificationSettingsMap: d.receiverNotificationSettingsMap || {},
      };
    }
  } catch (_err) {}

  const fallbackMenu = SEED_MENU_ITEMS.map((m) => ({
    ...m,
    image: resolveDishImage(m.image, m.category, m.id || m.name),
  }));

  return {
    branches: SEED_BRANCHES,
    menuItems: fallbackMenu,
    categories: [],
    tables: SEED_TABLES,
    orders: SEED_ORDERS,
    users: SEED_USERS,
    refunds: [],
    shifts: [],
    sessions: [],
    footerSettings: null,
    announcements: SEED_ANNOUNCEMENTS,
    notifications: SEED_NOTIFICATIONS,
    notificationSettings: null,
    receiverNotificationSettingsMap: {},
  };
}

export async function postNotificationToServer(payload: Partial<AppNotification> & { title: string; message: string }) {
  return apiFetch<{ notification?: AppNotification; error?: string }>('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateNotificationSettingsOnServer(
  settings: NotificationSettings,
  actorName?: string,
  authToken?: string
) {
  return apiFetch<{ notificationSettings?: NotificationSettings; error?: string }>('/api/notifications', {
    method: 'POST',
    ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
    body: JSON.stringify({
      action: 'update_settings',
      settings,
      actorName,
    }),
  });
}

export async function updateReceiverNotificationSettingsOnServer(
  receiverKey: string,
  settings: Partial<ReceiverNotificationPreferences>,
  authToken?: string
) {
  return apiFetch<{
    success?: boolean;
    receiverKey?: string;
    settings?: ReceiverNotificationPreferences;
    receiverSettingsMap?: Record<string, ReceiverNotificationPreferences>;
    error?: string;
  }>('/api/notifications', {
    method: 'POST',
    ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
    body: JSON.stringify({
      action: 'update_receiver_settings',
      receiverKey,
      settings,
    }),
  });
}

export async function patchNotificationReadOnServer(payload: {
  id?: string;
  markAll?: boolean;
  userKey: string;
}) {
  return apiFetch<{ ok?: boolean }>('/api/notifications', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteNotificationsOnServer(payload: {
  id?: string;
  clearAll?: boolean;
  branchId?: string;
}) {
  const params = new URLSearchParams();
  if (payload.id) params.set('id', payload.id);
  if (payload.clearAll) params.set('clearAll', 'true');
  if (payload.branchId) params.set('branchId', payload.branchId);
  return apiFetch<{ ok?: boolean }>(`/api/notifications?${params.toString()}`, {
    method: 'DELETE',
  });
}
