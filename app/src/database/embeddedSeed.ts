// Embedded Fallback Database Schema & Master Seed for Serverless / Vercel Deployments
import { MenuItem } from '@/types/cafe';

export const INITIAL_CATEGORIES: string[] = [
  'Deals',
  'Biryani & Rice',
  'Karahi & Handi',
  'BBQ & Kebabs',
  'Burgers & Fast Food',
  'Tandoor & Breads',
  'Beverages & Desserts',
];

export const INITIAL_MENU: MenuItem[] = [
  // 0. Deals & Combos
  {
    id: 'deal-1',
    name: 'Family Dum Biryani Feast (Deal for 3-4)',
    category: 'Deals',
    description: '2x Royal Chicken Biryani, 1x Half Chicken Boti BBQ, 2x Mint Margaritas, Fresh Zeera Raita & Salad.',
    basePrice: 1650,
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    branchPriceOverrides: { 'gulberg-lahore': 1650, 'f7-islamabad': 1590, 'clifton-karachi': 1690 },
    sizes: [{ name: 'Family Combo', priceDelta: 0 }],
  },
  {
    id: 'deal-2',
    name: 'Shinwari Karahi Duo Combo (Deal for 2)',
    category: 'Deals',
    description: 'Half Desi Ghee Shinwari Chicken Karahi, 4x Fresh Roghni Naan, 2x Soft Drinks & Mint Chutney.',
    basePrice: 1550,
    image: '/hero-bg.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    branchPriceOverrides: { 'gulberg-lahore': 1550, 'f7-islamabad': 1490, 'clifton-karachi': 1590 },
    sizes: [{ name: '2 Persons', priceDelta: 0 }],
  },
  {
    id: 'deal-3',
    name: 'Smashed Burger & Fries Crave Deal',
    category: 'Deals',
    description: '1x Double Beef Smashed Cheeseburger, 1x Peri Peri Loaded Fries & 1x Artisanal Mint Margarita.',
    basePrice: 1190,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    branchPriceOverrides: { 'gulberg-lahore': 1190, 'f7-islamabad': 1150, 'clifton-karachi': 1220 },
    sizes: [{ name: 'Single Meal', priceDelta: 0 }],
  },
  {
    id: 'deal-4',
    name: 'Midnight BBQ Feast Deal',
    category: 'Deals',
    description: '4 pcs Reshmi Chicken Kebabs, 6 pcs Chicken Malai Boti, 2x Garlic Butter Naans, Raita & Salad.',
    basePrice: 1290,
    image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=60',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    branchPriceOverrides: { 'gulberg-lahore': 1290, 'f7-islamabad': 1250, 'clifton-karachi': 1320 },
    sizes: [{ name: 'Sharing Platter', priceDelta: 0 }],
  },
  // 1. Biryani & Rice
  {
    id: 'm1',
    name: 'Royal Chicken Dum Biryani',
    category: 'Biryani & Rice',
    description: 'Fragrant long-grain basmati cooked with saffron, marinated chicken, caramelised onions & secret house spices in a sealed copper handi.',
    basePrice: 650,
    image: '/food-biryani.jpg',
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
    image: '/food-biryani.jpg',
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
    image: '/food-biryani.jpg',
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
    image: '/hero-bg.jpg',
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
    image: '/hero-bg.jpg',
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
    image: '/hero-bg.jpg',
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
    image: '/hero-bg.jpg',
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
    image: '/hero-bg.jpg',
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
    image: '/hero-bg.jpg',
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
    image: '/hero-bg.jpg',
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
    image: '/hero-bg.jpg',
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
    image: '/hero-bg.jpg',
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
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm16',
    name: 'Roasted Garlic Butter Naan',
    category: 'Tandoor & Breads',
    description: 'Fresh clay oven tandoori bread slathered in melted butter, roasted minced garlic, and chopped coriander leaves.',
    basePrice: 110,
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm17',
    name: 'Cheese Stuffed Tandoori Naan',
    category: 'Tandoor & Breads',
    description: 'Crispy outside, molten inside! Stuffed with mozzarella & mild cheddar cheese, herbs and brushed with butter.',
    basePrice: 240,
    image: '/food-biryani.jpg',
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
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm7',
    name: 'Shahi Malai Kulfi on Stick',
    category: 'Beverages & Desserts',
    description: 'Dense, creamy frozen dessert made from reduced whole milk, infused with roasted pistachios, almonds, and rose essence.',
    basePrice: 220,
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm18',
    name: 'Artisanal Fresh Mint Margarita',
    category: 'Beverages & Desserts',
    description: 'Fresh mint leaves blended with fresh lime juice, black rock salt, and ice-cold soda. The ultimate refreshing palate cleanser.',
    basePrice: 260,
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm19',
    name: 'Special Karak Doodh Patti Chai',
    category: 'Beverages & Desserts',
    description: 'Slow-simmered rich full-cream milk tea brewed with cardamom pods and premium CTC black tea leaves.',
    basePrice: 130,
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm20',
    name: 'Hot Gulab Jamun with Rabri (2 Pcs)',
    category: 'Beverages & Desserts',
    description: 'Soft hot fried dumplings soaked in rose cardamom syrup, served on a chilled bed of thickened pistachio malai rabri.',
    basePrice: 290,
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
];

export const FALLBACK_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    opening_hours VARCHAR(100) NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT true,
    is_busy BOOLEAN NOT NULL DEFAULT false,
    prep_time_estimate_min INT NOT NULL DEFAULT 25,
    full_edit_window_min INT NOT NULL DEFAULT 10,
    stop_add_ons_min_before_ready INT NOT NULL DEFAULT 5,
    delivery_enabled BOOLEAN NOT NULL DEFAULT true,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    max_order_distance_km DOUBLE PRECISION NOT NULL DEFAULT 50,
    table_qr_max_distance_meters INT NOT NULL DEFAULT 300,
    min_delivery_amount INT NOT NULL DEFAULT 500,
    payment_settings JSONB NOT NULL DEFAULT '{"dine_in":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"takeaway":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"delivery":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false}}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    role VARCHAR(50) NOT NULL,
    branch_id VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    no_show_count INT NOT NULL DEFAULT 0,
    password_hash VARCHAR(255),
    rider_availability VARCHAR(30) DEFAULT 'available',
    rider_total_deliveries INT DEFAULT 0,
    rider_active_order_id VARCHAR(64),
    assigned_floor VARCHAR(100),
    assigned_table_numbers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL,
    image TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    branch_availability JSONB NOT NULL DEFAULT '{}'::jsonb,
    branch_price_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
    extras JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tables (
    id VARCHAR(64) PRIMARY KEY,
    number VARCHAR(20) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    chairs INT NOT NULL DEFAULT 4,
    floor VARCHAR(100) NOT NULL DEFAULT 'Ground Floor',
    status VARCHAR(30) NOT NULL DEFAULT 'available',
    current_order_id VARCHAR(64),
    seated_at TIMESTAMPTZ,
    reserved_for VARCHAR(255),
    pin VARCHAR(10),
    qr_code TEXT,
    qr_expires_at TIMESTAMPTZ,
    allow_qr_reserved BOOLEAN DEFAULT false,
    assigned_waiter_id VARCHAR(64),
    assigned_waiter_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, number)
);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    branch_id VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    type VARCHAR(30) NOT NULL,
    table_number VARCHAR(20),
    table_pin VARCHAR(10),
    pickup_time VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'placed',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    original_subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    add_on_subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    preparation_started_at TIMESTAMPTZ,
    ready_time_estimated TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    delivery_address TEXT,
    version INT NOT NULL DEFAULT 1,
    cashier_id VARCHAR(64),
    cashier_name VARCHAR(255),
    is_walk_in BOOLEAN DEFAULT false,
    assigned_rider_id VARCHAR(64),
    assigned_rider_name VARCHAR(255),
    rider_status VARCHAR(30),
    delivered_at TIMESTAMPTZ,
    payment_collected BOOLEAN DEFAULT false,
    customer_coordinates JSONB,
    assigned_waiter_id VARCHAR(64),
    assigned_waiter_name VARCHAR(255),
    is_table_qr BOOLEAN DEFAULT false,
    waiter_notified BOOLEAN DEFAULT false,
    sent_to_kitchen BOOLEAN DEFAULT false,
    sent_to_kitchen_at TIMESTAMPTZ,
    forward_to_kitchen_at TIMESTAMPTZ,
    auto_forward_custom_min INT,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_shifts (
    id VARCHAR(64) PRIMARY KEY,
    cashier_id VARCHAR(64) NOT NULL,
    cashier_name VARCHAR(255) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    opening_float NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cash_collected NUMERIC(10, 2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(10, 2) NOT NULL DEFAULT 0,
    counted_cash NUMERIC(10, 2),
    difference NUMERIC(10, 2),
    difference_reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS refund_requests (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'requested',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    branch_id VARCHAR(64),
    action VARCHAR(50) NOT NULL,
    details TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT
);

CREATE TABLE IF NOT EXISTS hero_banners (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT NOT NULL,
    badge VARCHAR(100),
    image_url TEXT NOT NULL,
    category_link VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deal_cards (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'primary-deal',
    title VARCHAR(255) NOT NULL,
    subtitle TEXT NOT NULL,
    price VARCHAR(50) NOT NULL,
    tag VARCHAR(50) NOT NULL,
    image_url TEXT NOT NULL,
    category_link VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS footer_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
    helpline VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    hours VARCHAR(100) NOT NULL,
    address_lahore TEXT NOT NULL,
    address_islamabad TEXT NOT NULL,
    address_karachi TEXT NOT NULL,
    tagline TEXT NOT NULL,
    copyright_text TEXT NOT NULL,
    whatsapp VARCHAR(50),
    instagram VARCHAR(100),
    facebook VARCHAR(100),
    tiktok VARCHAR(100),
    order_routing_support_first BOOLEAN NOT NULL DEFAULT true,
    auto_forward_kitchen_min INT NOT NULL DEFAULT 3,
    auto_forward_mode VARCHAR(30) NOT NULL DEFAULT 'timed',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS table_sessions (
    id VARCHAR(64) PRIMARY KEY,
    table_id VARCHAR(64) NOT NULL,
    table_number VARCHAR(20) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    floor VARCHAR(100) NOT NULL DEFAULT 'Ground Floor',
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    duration_min INT,
    customer_name VARCHAR(255),
    order_id VARCHAR(64),
    order_number VARCHAR(50),
    waiter_name VARCHAR(255) DEFAULT 'Kashif Ali (Floor Staff)',
    total_amount NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'occupied',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    tag VARCHAR(64) NOT NULL DEFAULT 'ANNOUNCEMENT',
    description TEXT NOT NULL,
    valid_until VARCHAR(100),
    branch_id VARCHAR(64),
    branch_name VARCHAR(100),
    discount_percent INT,
    badge_color VARCHAR(50) DEFAULT '#EF4444',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_otps (
    email VARCHAR(255) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_history (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL DEFAULT 'system',
    actor_name VARCHAR(255) NOT NULL DEFAULT 'System',
    actor_role VARCHAR(50) NOT NULL DEFAULT 'system',
    change_type VARCHAR(50) NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    old_payment_status VARCHAR(30),
    new_payment_status VARCHAR(30),
    old_total NUMERIC(10, 2),
    new_total NUMERIC(10, 2),
    version INT NOT NULL DEFAULT 1,
    details TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'info',
    category VARCHAR(50) NOT NULL DEFAULT 'system',
    branch_id VARCHAR(100) DEFAULT 'all',
    order_id VARCHAR(100),
    order_number VARCHAR(64),
    order_type VARCHAR(30),
    sender_id VARCHAR(100),
    sender_name VARCHAR(150),
    sender_role VARCHAR(50),
    target_roles JSONB NOT NULL DEFAULT '["all"]'::jsonb,
    target_platform VARCHAR(20) NOT NULL DEFAULT 'all',
    target_user_id VARCHAR(100),
    target_customer_phone VARCHAR(50),
    target_customer_name VARCHAR(150),
    target_waiter_id VARCHAR(100),
    target_waiter_name VARCHAR(150),
    target_rider_id VARCHAR(100),
    target_rider_name VARCHAR(150),
    read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'global',
    default_platform VARCHAR(20) NOT NULL DEFAULT 'all',
    notify_customer BOOLEAN NOT NULL DEFAULT true,
    notify_concerned_rider BOOLEAN NOT NULL DEFAULT true,
    notify_concerned_waiter BOOLEAN NOT NULL DEFAULT true,
    notify_kitchen BOOLEAN NOT NULL DEFAULT true,
    notify_cashier_and_manager BOOLEAN NOT NULL DEFAULT true,
    events JSONB NOT NULL DEFAULT '{"orderPlaced":true,"sentToKitchen":true,"cooking":true,"orderReady":true,"outForDelivery":true,"orderServed":true,"orderCompleted":true,"orderCancelled":true,"waiterAssigned":true,"riderAssigned":true,"paymentReceived":true}'::jsonb,
    recipient_rules JSONB NOT NULL DEFAULT '{"customer":{"orderPlaced":true,"cooking":true,"orderReady":true,"outForDelivery":true,"orderCompleted":true,"orderCancelled":true},"rider":{"orderAssigned":true,"orderReady":true,"orderCancelled":true},"waiter":{"orderAssigned":true,"orderReady":true,"orderCancelled":true},"kitchen":{"newOrderPlaced":true,"orderCancelled":true},"cashierAndManager":{"orderPlaced":true,"orderCancelled":true,"paymentReceived":true}}'::jsonb,
    updated_by VARCHAR(150),
    updated_by_role VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS recipient_rules JSONB;

CREATE TABLE IF NOT EXISTS banner_deal_approval_requests (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL,
    target_id VARCHAR(64),
    submitted_by VARCHAR(255) NOT NULL,
    submitted_by_role VARCHAR(50) NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    banner_data JSONB,
    deal_data JSONB,
    decision_by VARCHAR(255),
    decision_at TIMESTAMPTZ,
    notes TEXT
);
`;

export const FALLBACK_SEED_SQL = `
INSERT INTO branches (id, name, city, address, phone, opening_hours, is_open, is_busy, prep_time_estimate_min, full_edit_window_min, stop_add_ons_min_before_ready, delivery_enabled, latitude, longitude, max_order_distance_km, table_qr_max_distance_meters, min_delivery_amount, payment_settings)
VALUES
('gulberg-lahore', 'Gulberg Branch (Flagship)', 'Lahore', '92-B2, Mian Mehmood Ali Kasoori Rd, Gulberg III, Lahore', '+92 42 3578 9101', '11:00 AM - 1:00 AM', true, false, 20, 15, 10, true, 31.5126, 74.3436, 50, 300, 500, '{"dine_in":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"takeaway":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"delivery":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":true}}'::jsonb),
('f7-islamabad', 'F-7 Markaz Branch', 'Islamabad', 'Shop 4-B, College Road, F-7 Markaz, Islamabad', '+92 51 2654 321', '12:00 PM - 12:00 AM', true, true, 30, 15, 10, true, 33.7215, 73.0552, 50, 300, 500, '{"dine_in":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"takeaway":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"delivery":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false}}'::jsonb),
('clifton-karachi', 'Clifton Block 4 Branch', 'Karachi', 'Plot 12-C, 26th Street, Block 4, Clifton, Karachi', '+92 21 3587 6543', '1:00 PM - 2:00 AM', true, false, 25, 15, 10, true, 24.8252, 67.0305, 50, 300, 500, '{"dine_in":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"takeaway":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"delivery":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":true}}'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_open = EXCLUDED.is_open, payment_settings = EXCLUDED.payment_settings;

INSERT INTO categories (id, name, display_order)
VALUES
('cat-1', 'Biryani & Rice', 1),
('cat-2', 'Karahi & Handi', 2),
('cat-3', 'BBQ & Kebabs', 3),
('cat-4', 'Burgers & Fast Food', 4),
('cat-5', 'Tandoor & Breads', 5),
('cat-6', 'Beverages & Desserts', 6)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, display_order = EXCLUDED.display_order;

INSERT INTO users (id, name, phone, email, address, role, branch_id, status, no_show_count, password_hash)
VALUES
('user-cust', 'Zeeshan Ahmed', '+92 301 5551234', 'zeeshan@example.com', 'House 14, Street 9, Model Town, Lahore', 'customer', NULL, 'active', 0, 'password123'),
('user-owner', 'Malik Jahangir', '+92 300 0000001', 'owner@foodiescafe.pk', NULL, 'platform_owner', NULL, 'active', 0, 'password123'),
('user-bm', 'Rashid Mehmood', '+92 300 2223344', 'manager.gulberg@foodiescafe.pk', NULL, 'branch_manager', 'gulberg-lahore', 'active', 0, 'password123'),
('user-kitchen', 'Chef Ustaad Aslam', '+92 300 6667788', 'kitchen.gulberg@foodiescafe.pk', NULL, 'kitchen_staff', 'gulberg-lahore', 'active', 0, 'password123'),
('user-cashier', 'Bilal Farooq', '+92 300 8889900', 'cashier.gulberg@foodiescafe.pk', NULL, 'cashier', 'gulberg-lahore', 'active', 0, 'password123'),
('user-floor', 'Kashif Ali', '+92 300 1112233', 'floor.gulberg@foodiescafe.pk', NULL, 'floor_staff', 'gulberg-lahore', 'active', 0, 'password123'),
('user-rider-1', 'Tariq Mehmood', '+92 301 9991122', 'rider1.gulberg@foodiescafe.pk', NULL, 'delivery_staff', 'gulberg-lahore', 'active', 0, 'password123'),
('user-rider-2', 'Usman Ghani', '+92 302 8882233', 'rider2.gulberg@foodiescafe.pk', NULL, 'delivery_staff', 'gulberg-lahore', 'active', 0, 'password123'),
('user-bm-isb', 'Noman Bashir', '+92 300 3334455', 'manager.islamabad@foodiescafe.pk', NULL, 'branch_manager', 'f7-islamabad', 'active', 0, 'password123'),
('user-cashier-isb', 'Hamza Tariq', '+92 300 3338899', 'cashier.islamabad@foodiescafe.pk', NULL, 'cashier', 'f7-islamabad', 'active', 0, 'password123'),
('user-bm-khi', 'Kamran Siddiqui', '+92 300 5556677', 'manager.karachi@foodiescafe.pk', NULL, 'branch_manager', 'clifton-karachi', 'active', 0, 'password123')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;

INSERT INTO menu_items (id, name, category, description, base_price, image, is_available, branch_availability, branch_price_overrides, sizes, extras)
VALUES
('m1', 'Royal Chicken Dum Biryani', 'Biryani & Rice', 'Fragrant long-grain basmati cooked with saffron, marinated chicken, caramelised onions & secret house spices in a sealed copper handi.', 650, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{"gulberg-lahore":750,"f7-islamabad":620,"clifton-karachi":680}'::jsonb, '[{"name":"Regular (Single)","priceDelta":0},{"name":"Jumbo (Double)","priceDelta":350}]'::jsonb, '[{"name":"Extra Zeera Raita","price":60},{"name":"Fresh Kachumber Salad","price":70},{"name":"Extra Boiled Egg","price":50}]'::jsonb),
('m8', 'Mutton Special Dum Biryani', 'Biryani & Rice', 'Slow-cooked succulent baby mutton pieces layered with aged basmati rice, whole cardamoms, fried onions and saffron steam.', 950, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{"gulberg-lahore":1050,"f7-islamabad":920,"clifton-karachi":990}'::jsonb, '[{"name":"Single Pot","priceDelta":0},{"name":"Family Platter (Serves 3)","priceDelta":850}]'::jsonb, '[{"name":"Extra Zeera Raita","price":60},{"name":"Fresh Kachumber Salad","price":70}]'::jsonb),
('m9', 'Matka Dum Biryani with Chicken', 'Biryani & Rice', 'Traditional earthen clay pot chicken biryani sealed with dough, delivering intense smoky aroma, spiced potatoes and tender chicken.', 720, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[{"name":"Standard Matka","priceDelta":0},{"name":"Jumbo Matka","priceDelta":320}]'::jsonb, '[{"name":"Mint Raita","price":60},{"name":"Spicy Chutney","price":50}]'::jsonb),
('m2', 'Desi Ghee Shinwari Chicken Karahi', 'Karahi & Handi', 'Fresh country chicken wok-tossed in pure organic desi ghee, ripe tomatoes, coarse crushed black pepper and ginger juliennes.', 1250, '/hero-bg.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{"gulberg-lahore":1350,"f7-islamabad":1180,"clifton-karachi":1280}'::jsonb, '[{"name":"Half (serves 2)","priceDelta":0},{"name":"Full (serves 4)","priceDelta":1100}]'::jsonb, '[{"name":"Roghni Naan","price":80},{"name":"Garlic Butter Naan","price":110},{"name":"Mint Chutney","price":50}]'::jsonb),
('m10', 'Boneless Chicken Makhni Handi', 'Karahi & Handi', 'Velvety smooth tomato cream gravy with tender boneless chicken breast cubes, topped with fresh dairy butter and kasuri methi.', 1180, '/hero-bg.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[{"name":"Half (serves 2)","priceDelta":0},{"name":"Full (serves 4)","priceDelta":970}]'::jsonb, '[{"name":"Garlic Butter Naan","price":110},{"name":"Extra Makhni Gravy","price":150}]'::jsonb),
('m11', 'Peshawari Mutton Shinwari Karahi', 'Karahi & Handi', 'Prime mutton cuts simmered in pure animal fat and butter with salt, green chilies and fresh tomatoes in a traditional charcoal wok.', 1850, '/hero-bg.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[{"name":"Half KG (serves 2)","priceDelta":0},{"name":"Full KG (serves 4)","priceDelta":1600}]'::jsonb, '[{"name":"Tandoori Roti (2 pcs)","price":70},{"name":"Roghni Naan","price":80}]'::jsonb),
('m3', 'Smoky Beef Seekh Kebabs (4 Pcs)', 'BBQ & Kebabs', 'Melt-in-mouth prime beef mince seasoned with roasted cumin, brown onion paste, coriander seeds and charcoal grilled over hot embers.', 780, '/hero-bg.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[{"name":"Standard (4 pcs)","priceDelta":0},{"name":"Platter (8 pcs)","priceDelta":680}]'::jsonb, '[{"name":"Tandoori Paratha","price":90},{"name":"Mint Coriander Dip","price":40}]'::jsonb),
('m12', 'Charcoal Grilled Chicken Malai Boti', 'BBQ & Kebabs', 'Creamy boneless chicken thigh cubes marinated in heavy malai, crushed green chilies, white pepper, and seared over charcoal.', 820, '/hero-bg.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[{"name":"Single Skewer (8 pcs)","priceDelta":0},{"name":"Double Skewer (16 pcs)","priceDelta":740}]'::jsonb, '[{"name":"Garlic Naan","price":110},{"name":"Imli Chutney","price":50}]'::jsonb),
('m13', 'Mutton Balochi Chops (3 Pcs)', 'BBQ & Kebabs', 'Tender mutton chops marinated in Balochi dried spices, ginger garlic paste and slow grilled till charred and crispy outside.', 1450, '/hero-bg.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[{"name":"Standard (3 pcs)","priceDelta":0},{"name":"Feast (6 pcs)","priceDelta":1350}]'::jsonb, '[{"name":"Peshawari Chutney","price":60},{"name":"Roghni Naan","price":80}]'::jsonb),
('m4', 'The Foodies Crunch Burger', 'Burgers & Fast Food', 'Crispy fried buttermilk chicken fillet tossed in spicy glaze, topped with cheddar cheese, tangy coleslaw, garlic aioli on a toasted brioche.', 620, '/hero-bg.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[{"name":"Single Fillet","priceDelta":0},{"name":"Double Monster Fillet","priceDelta":280}]'::jsonb, '[{"name":"Seasoned Masala Fries","price":160},{"name":"Cheese Dip Shot","price":90}]'::jsonb),
('m14', 'Double Beef Smashed Cheeseburger', 'Burgers & Fast Food', 'Two seared prime beef patties, double melted cheddar, caramelized onions, crisp iceberg lettuce and house secret sauce on potato bun.', 840, '/hero-bg.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{"gulberg-lahore":890,"f7-islamabad":790,"clifton-karachi":850}'::jsonb, '[{"name":"Double Patty","priceDelta":0},{"name":"Triple Monster Patty","priceDelta":310}]'::jsonb, '[{"name":"Crispy Curly Fries","price":190},{"name":"Truffle Mayo","price":80}]'::jsonb),
('m15', 'Peri Peri Loaded Crispy Fries', 'Burgers & Fast Food', 'Skin-on golden fries smothered with spicy crispy chicken chunks, warm cheddar cheese sauce, garlic ranch and pickled jalapeños.', 420, '/hero-bg.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[{"name":"Regular Box","priceDelta":0},{"name":"Party Sharing Platter","priceDelta":340}]'::jsonb, '[{"name":"Extra Cheddar Sauce","price":80},{"name":"Jalapeño Bombs (4 pcs)","price":140}]'::jsonb),
('m5', 'Fresh Tandoori Roghni Naan', 'Tandoor & Breads', 'Soft leavened bread brushed with clarified butter, toasted white sesame seeds and baked against clay tandoor walls.', 80, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb),
('m16', 'Roasted Garlic Butter Naan', 'Tandoor & Breads', 'Fresh clay oven tandoori bread slathered in melted butter, roasted minced garlic, and chopped coriander leaves.', 110, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb),
('m17', 'Cheese Stuffed Tandoori Naan', 'Tandoor & Breads', 'Crispy outside, molten inside! Stuffed with mozzarella & mild cheddar cheese, herbs and brushed with butter.', 240, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb),
('m6', 'Traditional Peshawari Qahwa with Cardamom', 'Beverages & Desserts', 'Brewed green tea leaves infused with green cardamom pods, cinnamon bark, served with saffron candy crystals.', 120, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb),
('m7', 'Shahi Malai Kulfi on Stick', 'Beverages & Desserts', 'Dense, creamy frozen dessert made from reduced whole milk, infused with roasted pistachios, almonds, and rose essence.', 220, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb),
('m18', 'Artisanal Fresh Mint Margarita', 'Beverages & Desserts', 'Fresh mint leaves blended with fresh lime juice, black rock salt, and ice-cold soda. The ultimate refreshing palate cleanser.', 260, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb),
('m19', 'Special Karak Doodh Patti Chai', 'Beverages & Desserts', 'Slow-simmered rich full-cream milk tea brewed with cardamom pods and premium CTC black tea leaves.', 130, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb),
('m20', 'Hot Gulab Jamun with Rabri (2 Pcs)', 'Beverages & Desserts', 'Soft hot fried dumplings soaked in rose cardamom syrup, served on a chilled bed of thickened pistachio malai rabri.', 290, '/food-biryani.jpg', true, '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    base_price = EXCLUDED.base_price,
    description = EXCLUDED.description,
    is_available = EXCLUDED.is_available,
    branch_availability = EXCLUDED.branch_availability,
    branch_price_overrides = EXCLUDED.branch_price_overrides,
    sizes = EXCLUDED.sizes,
    extras = EXCLUDED.extras;

INSERT INTO tables (id, number, branch_id, floor, capacity, chairs, status, pin)
VALUES
('t1', 'T-01', 'gulberg-lahore', 'Ground Floor (Main Dining)', 2, 2, 'available', '4921'),
('t2', 'T-02', 'gulberg-lahore', 'Ground Floor (Main Dining)', 4, 4, 'available', '7182'),
('t3', 'T-03', 'gulberg-lahore', 'Ground Floor (Main Dining)', 4, 4, 'available', '3941'),
('t4', 'T-04', 'gulberg-lahore', 'Ground Floor (Main Dining)', 6, 6, 'available', '8812'),
('t5', 'T-05', 'gulberg-lahore', '1st Floor (Family Hall)', 4, 4, 'available', '1092'),
('t6', 'T-06', 'gulberg-lahore', '1st Floor (Family Hall)', 8, 8, 'available', '6523'),
('t7', 'T-07', 'gulberg-lahore', 'Rooftop Terrace (Open Air)', 4, 4, 'available', '9901'),
('t8', 'T-08', 'gulberg-lahore', 'Rooftop Terrace (Open Air)', 2, 2, 'available', '2311'),
('t9', 'T-01', 'f7-islamabad', 'Ground Floor (Main Dining)', 4, 4, 'available', '3312'),
('t10', 'T-02', 'f7-islamabad', 'Ground Floor (Main Dining)', 6, 6, 'available', '4419'),
('t11', 'T-03', 'f7-islamabad', '1st Floor (Family Hall)', 4, 4, 'available', '5521'),
('t12', 'T-01', 'clifton-karachi', 'Ground Floor (Main Dining)', 4, 4, 'available', '6618'),
('t13', 'T-02', 'clifton-karachi', 'Rooftop Terrace (Open Air)', 6, 6, 'available', '7729')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, pin = EXCLUDED.pin;

INSERT INTO footer_settings (id, helpline, email, hours, address_lahore, address_islamabad, address_karachi, tagline, copyright_text)
VALUES
('default', '+92 42 111-FOODIES', 'feedback@foodiescafe.pk', 'Daily 11:00 AM - 1:00 AM', '92-B2, Mian Mehmood Ali Kasoori Rd, Gulberg III, Lahore', 'Shop 4-B, College Road, F-7 Markaz, Islamabad', 'Plot 12-C, 26th Street, Block 4, Clifton, Karachi', 'Quality multi-branch cafe experience in Pakistan. Authentic recipes, spotless kitchens, and friendly hospitality.', '© 2026 Foodies Cafe Pakistan.')
ON CONFLICT (id) DO UPDATE SET helpline = EXCLUDED.helpline, email = EXCLUDED.email, hours = EXCLUDED.hours, tagline = EXCLUDED.tagline;

INSERT INTO hero_banners (id, title, subtitle, badge, image_url, category_link, active, display_order)
VALUES
('b-1', 'Eat Fresh & Healthy, Cooked with Passion', 'Authentic clay oven dum biryanis, organic desi ghee Shinwari karahi, and gourmet smash burgers across Lahore, Islamabad & Karachi.', 'Multi-Branch Pakistani Fine Dining & Fast Casual', '/hero-bg.jpg', 'Biryani & Rice', true, 1),
('b-2', 'Royal Handi & Desi Ghee Shinwari Karahi', 'Tender mutton & chicken simmered in copper handis with freshly crushed peppercorns and pure organic butter.', '🔥 Chef Handi Special', '/food-biryani.jpg', 'Karahi & Handi', true, 2),
('b-3', 'Juicy Gourmet Smash Burgers & Loaded Fries', 'Crispy seasoned fillets & smashed patties layered with molten cheddar, house pickles, and brioche buns.', '🍔 Signature Fast-Casual Bites', '/hero-bg.jpg', 'Burgers & Fast Food', true, 3),
('b-4', 'Traditional Tandoor Naans & Cold Refreshers', 'Garlic butter naans, roghni naans, artisanal mint margaritas, and slow-brewed Karak Chai.', '❄️ Drinks & Fresh Breads', '/food-biryani.jpg', 'Beverages & Desserts', true, 4)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, image_url = EXCLUDED.image_url;

INSERT INTO deal_cards (id, title, subtitle, price, tag, image_url, category_link)
VALUES
('primary-deal', 'Royal Chicken Dum Biryani', 'Slow-steamed in copper handi with saffron & house spices', 'Rs. 650', '🌟 TODAY''S CHEF SPECIAL', '/food-biryani.jpg', 'Biryani & Rice')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, price = EXCLUDED.price;

INSERT INTO announcements (id, title, tag, description, valid_until, branch_id, branch_name, discount_percent, badge_color)
VALUES
('ann-1', 'Midnight Biryani & Karahi Feast: Flat 20% Off', 'HOT DEAL', 'Enjoy 20% off all Mutton & Chicken Karahi orders between 10:00 PM and 2:00 AM across all branches.', 'Tonight 02:00 AM', NULL, NULL, 20, '#EF4444'),
('ann-2', 'Gulberg Rooftop Terrace Live BBQ Night', 'BRANCH SPECIAL', 'Join us on the Gulberg Rooftop for live open-flame charcoal Seekh Kababs & Mutton Chops every Friday & Saturday.', 'Every Weekend', 'gulberg-lahore', 'Gulberg Lahore', NULL, '#F59E0B'),
('ann-3', 'Free Delivery on Doorstep Orders above Rs. 1500', 'ANNOUNCEMENT', 'Zero delivery fee on all online delivery orders exceeding Rs. 1500 via the mobile app.', 'Valid this Month', NULL, NULL, NULL, '#10B981')
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (id, title, message, type, category, branch_id, sender_id, sender_name, sender_role, target_roles, read_by)
VALUES
('notif-seed-1', 'Welcome to Foodies Cafe Live Alerts', 'Real-time order updates for Dine-In, Takeaway Pickup & Doorstep Delivery are active.', 'success', 'system', 'all', 'user-owner', 'Malik Jahangir', 'platform_owner', '["all"]'::jsonb, '[]'::jsonb),
('notif-seed-2', 'Takeaway Express Counter Open', 'Place a Takeaway order via Web or Mobile and receive an instant pickup notification as soon as it is packed.', 'info', 'takeaway', 'gulberg-lahore', 'user-cashier', 'Bilal Farooq', 'cashier', '["customer","cashier","branch_manager"]'::jsonb, '[]'::jsonb),
('notif-seed-3', 'Rush Hour Kitchen Coordination Active', 'Cashier, Kitchen, Waiters & Delivery Riders receive automatic alerts when orders are placed or updated.', 'warning', 'staff_alert', 'all', 'user-bm', 'Rashid Mehmood', 'branch_manager', '["branch_manager","cashier","kitchen_staff","floor_staff","delivery_staff","platform_owner"]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
`;

