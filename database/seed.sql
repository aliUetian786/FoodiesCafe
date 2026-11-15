-- ============================================================================
-- FoodiesCafe PostgreSQL Database Seed Data (seed.sql)
-- Initial master data for branches, menu items, users, tables, and settings
-- ============================================================================

-- 1. Branches Seed
INSERT INTO branches (id, name, city, address, phone, opening_hours, is_open, is_busy, prep_time_estimate_min, full_edit_window_min, stop_add_ons_min_before_ready, delivery_enabled, max_order_distance_km, table_qr_max_distance_meters, min_delivery_amount, payment_settings)
VALUES
(
    'gulberg-lahore',
    'Gulberg Branch (Flagship)',
    'Lahore',
    '92-B2, Mian Mehmood Ali Kasoori Rd, Gulberg III, Lahore',
    '+92 42 3578 9101',
    '11:00 AM - 1:00 AM',
    true,
    false,
    20,
    15,
    10,
    true,
    50,
    300,
    500,
    '{"dine_in":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"takeaway":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"delivery":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":true}}'::jsonb
),
(
    'f7-islamabad',
    'F-7 Markaz Branch',
    'Islamabad',
    'Shop 4-B, College Road, F-7 Markaz, Islamabad',
    '+92 51 2654 321',
    '12:00 PM - 12:00 AM',
    true,
    true,
    30,
    15,
    10,
    true,
    50,
    300,
    500,
    '{"dine_in":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"takeaway":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"delivery":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false}}'::jsonb
),
(
    'clifton-karachi',
    'Clifton Block 4 Branch',
    'Karachi',
    'Plot 12-C, 26th Street, Block 4, Clifton, Karachi',
    '+92 21 3587 6543',
    '1:00 PM - 2:00 AM',
    true,
    false,
    25,
    15,
    10,
    true,
    50,
    300,
    500,
    '{"dine_in":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"takeaway":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"delivery":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":true}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    opening_hours = EXCLUDED.opening_hours,
    payment_settings = EXCLUDED.payment_settings;

-- 2. Categories Seed
INSERT INTO categories (id, name, display_order)
VALUES
('cat-1', 'Biryani & Rice', 1),
('cat-2', 'Karahi & Handi', 2),
('cat-3', 'BBQ & Kebabs', 3),
('cat-4', 'Burgers & Fast Food', 4),
('cat-5', 'Tandoor & Breads', 5),
('cat-6', 'Beverages & Desserts', 6)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, display_order = EXCLUDED.display_order;

-- 3. Users Seed
INSERT INTO users (id, name, phone, email, address, role, branch_id, status, no_show_count, password_hash, rider_availability, rider_total_deliveries, rider_active_order_id)
VALUES
('user-cust', 'Zeeshan Ahmed', '+92 301 5551234', 'zeeshan@example.com', 'House 14, Street 9, Model Town, Lahore', 'customer', NULL, 'active', 0, 'password123', NULL, 0, NULL),
('user-owner', 'Malik Jahangir', '+92 300 0000001', 'owner@foodiescafe.pk', NULL, 'platform_owner', NULL, 'active', 0, 'password123', NULL, 0, NULL),
('user-bm', 'Rashid Mehmood', '+92 300 2223344', 'manager.gulberg@foodiescafe.pk', NULL, 'branch_manager', 'gulberg-lahore', 'active', 0, 'password123', NULL, 0, NULL),
('user-kitchen', 'Chef Ustaad Aslam', '+92 300 6667788', 'kitchen.gulberg@foodiescafe.pk', NULL, 'kitchen_staff', 'gulberg-lahore', 'active', 0, 'password123', NULL, 0, NULL),
('user-cashier', 'Bilal Farooq', '+92 300 8889900', 'cashier.gulberg@foodiescafe.pk', NULL, 'cashier', 'gulberg-lahore', 'active', 0, 'password123', NULL, 0, NULL),
('user-floor', 'Kashif Ali', '+92 300 1112233', 'floor.gulberg@foodiescafe.pk', NULL, 'floor_staff', 'gulberg-lahore', 'active', 0, 'password123', NULL, 0, NULL),
('user-rider-1', 'Tariq Mehmood', '+92 301 9991122', 'rider1.gulberg@foodiescafe.pk', NULL, 'delivery_staff', 'gulberg-lahore', 'active', 0, 'password123', 'available', 0, NULL),
('user-rider-2', 'Usman Ghani', '+92 302 8882233', 'rider2.gulberg@foodiescafe.pk', NULL, 'delivery_staff', 'gulberg-lahore', 'active', 0, 'password123', 'available', 0, NULL),
-- Islamabad Staff
('user-bm-isb', 'Noman Bashir', '+92 300 3334455', 'manager.islamabad@foodiescafe.pk', NULL, 'branch_manager', 'f7-islamabad', 'active', 0, 'password123', NULL, 0, NULL),
('user-cashier-isb', 'Hamza Tariq', '+92 300 3338899', 'cashier.islamabad@foodiescafe.pk', NULL, 'cashier', 'f7-islamabad', 'active', 0, 'password123', NULL, 0, NULL),
('user-kitchen-isb', 'Chef Imran Khan', '+92 300 3337766', 'kitchen.islamabad@foodiescafe.pk', NULL, 'kitchen_staff', 'f7-islamabad', 'active', 0, 'password123', NULL, 0, NULL),
('user-floor-isb', 'Fahad Mustafa', '+92 300 3336655', 'floor.islamabad@foodiescafe.pk', NULL, 'floor_staff', 'f7-islamabad', 'active', 0, 'password123', NULL, 0, NULL),
-- Karachi Staff
('user-bm-khi', 'Kamran Siddiqui', '+92 300 5556677', 'manager.karachi@foodiescafe.pk', NULL, 'branch_manager', 'clifton-karachi', 'active', 0, 'password123', NULL, 0, NULL),
('user-cashier-khi', 'Saad Ali', '+92 300 5558899', 'cashier.karachi@foodiescafe.pk', NULL, 'cashier', 'clifton-karachi', 'active', 0, 'password123', NULL, 0, NULL),
('user-kitchen-khi', 'Chef Zakir Hussain', '+92 300 5557766', 'kitchen.karachi@foodiescafe.pk', NULL, 'kitchen_staff', 'clifton-karachi', 'active', 0, 'password123', NULL, 0, NULL),
('user-floor-khi', 'Rizwan Ahmed', '+92 300 5556655', 'floor.karachi@foodiescafe.pk', NULL, 'floor_staff', 'clifton-karachi', 'active', 0, 'password123', NULL, 0, NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, branch_id = EXCLUDED.branch_id, password_hash = EXCLUDED.password_hash, rider_availability = COALESCE(users.rider_availability, EXCLUDED.rider_availability);

-- 4. Menu Items Seed (Full 20-Item Authentic Menu across all categories)
INSERT INTO menu_items (id, name, category, description, base_price, image, is_available, branch_availability, branch_price_overrides, sizes, extras)
VALUES
(
    'm1',
    'Royal Chicken Dum Biryani',
    'Biryani & Rice',
    'Fragrant long-grain basmati cooked with saffron, marinated chicken, caramelised onions & secret house spices in a sealed copper handi.',
    650,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{"gulberg-lahore":750,"f7-islamabad":620,"clifton-karachi":680}'::jsonb,
    '[{"name":"Regular (Single)","priceDelta":0},{"name":"Jumbo (Double)","priceDelta":350}]'::jsonb,
    '[{"name":"Extra Zeera Raita","price":60},{"name":"Fresh Kachumber Salad","price":70},{"name":"Extra Boiled Egg","price":50}]'::jsonb
),
(
    'm8',
    'Mutton Special Dum Biryani',
    'Biryani & Rice',
    'Slow-cooked succulent baby mutton pieces layered with aged basmati rice, whole cardamoms, fried onions and saffron steam.',
    950,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{"gulberg-lahore":1050,"f7-islamabad":920,"clifton-karachi":990}'::jsonb,
    '[{"name":"Single Pot","priceDelta":0},{"name":"Family Platter (Serves 3)","priceDelta":850}]'::jsonb,
    '[{"name":"Extra Zeera Raita","price":60},{"name":"Fresh Kachumber Salad","price":70}]'::jsonb
),
(
    'm9',
    'Matka Dum Biryani with Chicken',
    'Biryani & Rice',
    'Traditional earthen clay pot chicken biryani sealed with dough, delivering intense smoky aroma, spiced potatoes and tender chicken.',
    720,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[{"name":"Standard Matka","priceDelta":0},{"name":"Jumbo Matka","priceDelta":320}]'::jsonb,
    '[{"name":"Mint Raita","price":60},{"name":"Spicy Chutney","price":50}]'::jsonb
),
(
    'm2',
    'Desi Ghee Shinwari Chicken Karahi',
    'Karahi & Handi',
    'Fresh country chicken wok-tossed in pure organic desi ghee, ripe tomatoes, coarse crushed black pepper and ginger juliennes.',
    1250,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{"gulberg-lahore":1350,"f7-islamabad":1180,"clifton-karachi":1280}'::jsonb,
    '[{"name":"Half (serves 2)","priceDelta":0},{"name":"Full (serves 4)","priceDelta":1100}]'::jsonb,
    '[{"name":"Roghni Naan","price":80},{"name":"Garlic Butter Naan","price":110},{"name":"Mint Chutney","price":50}]'::jsonb
),
(
    'm10',
    'Boneless Chicken Makhni Handi',
    'Karahi & Handi',
    'Velvety smooth tomato cream gravy with tender boneless chicken breast cubes, topped with fresh dairy butter and kasuri methi.',
    1180,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[{"name":"Half (serves 2)","priceDelta":0},{"name":"Full (serves 4)","priceDelta":970}]'::jsonb,
    '[{"name":"Garlic Butter Naan","price":110},{"name":"Extra Makhni Gravy","price":150}]'::jsonb
),
(
    'm11',
    'Peshawari Mutton Shinwari Karahi',
    'Karahi & Handi',
    'Prime mutton cuts simmered in pure animal fat and butter with salt, green chilies and fresh tomatoes in a traditional charcoal wok.',
    1850,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[{"name":"Half KG (serves 2)","priceDelta":0},{"name":"Full KG (serves 4)","priceDelta":1600}]'::jsonb,
    '[{"name":"Tandoori Roti (2 pcs)","price":70},{"name":"Roghni Naan","price":80}]'::jsonb
),
(
    'm3',
    'Smoky Beef Seekh Kebabs (4 Pcs)',
    'BBQ & Kebabs',
    'Melt-in-mouth prime beef mince seasoned with roasted cumin, brown onion paste, coriander seeds and charcoal grilled over hot embers.',
    780,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[{"name":"Standard (4 pcs)","priceDelta":0},{"name":"Platter (8 pcs)","priceDelta":680}]'::jsonb,
    '[{"name":"Tandoori Paratha","price":90},{"name":"Mint Coriander Dip","price":40}]'::jsonb
),
(
    'm12',
    'Charcoal Grilled Chicken Malai Boti',
    'BBQ & Kebabs',
    'Creamy boneless chicken thigh cubes marinated in heavy malai, crushed green chilies, white pepper, and seared over charcoal.',
    820,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[{"name":"Single Skewer (8 pcs)","priceDelta":0},{"name":"Double Skewer (16 pcs)","priceDelta":740}]'::jsonb,
    '[{"name":"Garlic Naan","price":110},{"name":"Imli Chutney","price":50}]'::jsonb
),
(
    'm13',
    'Mutton Balochi Chops (3 Pcs)',
    'BBQ & Kebabs',
    'Tender mutton chops marinated in Balochi dried spices, ginger garlic paste and slow grilled till charred and crispy outside.',
    1450,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[{"name":"Standard (3 pcs)","priceDelta":0},{"name":"Feast (6 pcs)","priceDelta":1350}]'::jsonb,
    '[{"name":"Peshawari Chutney","price":60},{"name":"Roghni Naan","price":80}]'::jsonb
),
(
    'm4',
    'The Foodies Crunch Burger',
    'Burgers & Fast Food',
    'Crispy fried buttermilk chicken fillet tossed in spicy glaze, topped with cheddar cheese, tangy coleslaw, garlic aioli on a toasted brioche.',
    620,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[{"name":"Single Fillet","priceDelta":0},{"name":"Double Monster Fillet","priceDelta":280}]'::jsonb,
    '[{"name":"Seasoned Masala Fries","price":160},{"name":"Cheese Dip Shot","price":90}]'::jsonb
),
(
    'm14',
    'Double Beef Smashed Cheeseburger',
    'Burgers & Fast Food',
    'Two seared prime beef patties, double melted cheddar, caramelized onions, crisp iceberg lettuce and house secret sauce on potato bun.',
    840,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{"gulberg-lahore":890,"f7-islamabad":790,"clifton-karachi":850}'::jsonb,
    '[{"name":"Double Patty","priceDelta":0},{"name":"Triple Monster Patty","priceDelta":310}]'::jsonb,
    '[{"name":"Crispy Curly Fries","price":190},{"name":"Truffle Mayo","price":80}]'::jsonb
),
(
    'm15',
    'Peri Peri Loaded Crispy Fries',
    'Burgers & Fast Food',
    'Skin-on golden fries smothered with spicy crispy chicken chunks, warm cheddar cheese sauce, garlic ranch and pickled jalapeños.',
    420,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[{"name":"Regular Box","priceDelta":0},{"name":"Party Sharing Platter","priceDelta":340}]'::jsonb,
    '[{"name":"Extra Cheddar Sauce","price":80},{"name":"Jalapeño Bombs (4 pcs)","price":140}]'::jsonb
),
(
    'm5',
    'Fresh Tandoori Roghni Naan',
    'Tandoor & Breads',
    'Soft leavened bread brushed with clarified butter, toasted white sesame seeds and baked against clay tandoor walls.',
    80,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
),
(
    'm16',
    'Roasted Garlic Butter Naan',
    'Tandoor & Breads',
    'Fresh clay oven tandoori bread slathered in melted butter, roasted minced garlic, and chopped coriander leaves.',
    110,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
),
(
    'm17',
    'Cheese Stuffed Tandoori Naan',
    'Tandoor & Breads',
    'Crispy outside, molten inside! Stuffed with mozzarella & mild cheddar cheese, herbs and brushed with butter.',
    240,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
),
(
    'm6',
    'Traditional Peshawari Qahwa with Cardamom',
    'Beverages & Desserts',
    'Brewed green tea leaves infused with green cardamom pods, cinnamon bark, served with saffron candy crystals.',
    120,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
),
(
    'm7',
    'Shahi Malai Kulfi on Stick',
    'Beverages & Desserts',
    'Dense, creamy frozen dessert made from reduced whole milk, infused with roasted pistachios, almonds, and rose essence.',
    220,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
),
(
    'm18',
    'Artisanal Fresh Mint Margarita',
    'Beverages & Desserts',
    'Fresh mint leaves blended with fresh lime juice, black rock salt, and ice-cold soda. The ultimate refreshing palate cleanser.',
    260,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
),
(
    'm19',
    'Special Karak Doodh Patti Chai',
    'Beverages & Desserts',
    'Slow-simmered rich full-cream milk tea brewed with cardamom pods and premium CTC black tea leaves.',
    130,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
),
(
    'm20',
    'Hot Gulab Jamun with Rabri (2 Pcs)',
    'Beverages & Desserts',
    'Soft hot fried dumplings soaked in rose cardamom syrup, served on a chilled bed of thickened pistachio malai rabri.',
    290,
    '/food-biryani.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
)
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

-- 5. Tables Seed
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

-- 6. Footer Settings Seed
INSERT INTO footer_settings (id, helpline, email, hours, address_lahore, address_islamabad, address_karachi, tagline, copyright_text)
VALUES
(
    'default',
    '+92 42 111-FOODIES',
    'feedback@foodiescafe.pk',
    'Daily 11:00 AM - 1:00 AM',
    '92-B2, Mian Mehmood Ali Kasoori Rd, Gulberg III, Lahore',
    'Shop 4-B, College Road, F-7 Markaz, Islamabad',
    'Plot 12-C, 26th Street, Block 4, Clifton, Karachi',
    'Quality multi-branch cafe experience in Pakistan. Authentic recipes, spotless kitchens, and friendly hospitality.',
    '© 2026 Foodies Cafe Pakistan.'
)
ON CONFLICT (id) DO UPDATE SET
    helpline = EXCLUDED.helpline,
    email = EXCLUDED.email,
    hours = EXCLUDED.hours,
    tagline = EXCLUDED.tagline;

-- 7. Hero Banners Seed
INSERT INTO hero_banners (id, title, subtitle, badge, image_url, category_link, active, display_order)
VALUES
('b-1', 'Eat Fresh & Healthy, Cooked with Passion', 'Authentic clay oven dum biryanis, organic desi ghee Shinwari karahi, and gourmet smash burgers across Lahore, Islamabad & Karachi.', 'Multi-Branch Pakistani Fine Dining & Fast Casual', '/hero-bg.jpg', 'Biryani & Rice', true, 1),
('b-2', 'Royal Handi & Desi Ghee Shinwari Karahi', 'Tender mutton & chicken simmered in copper handis with freshly crushed peppercorns and pure organic butter.', '🔥 Chef Handi Special', '/food-biryani.jpg', 'Karahi & Handi', true, 2),
('b-3', 'Juicy Gourmet Smash Burgers & Loaded Fries', 'Crispy seasoned fillets & smashed patties layered with molten cheddar, house pickles, and brioche buns.', '🍔 Signature Fast-Casual Bites', '/hero-bg.jpg', 'Burgers & Fast Food', true, 3),
('b-4', 'Traditional Tandoor Naans & Cold Refreshers', 'Garlic butter naans, roghni naans, artisanal mint margaritas, and slow-brewed Karak Chai.', '❄️ Drinks & Fresh Breads', '/food-biryani.jpg', 'Beverages & Desserts', true, 4)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, image_url = EXCLUDED.image_url;

-- 8. Deals Seed
INSERT INTO deal_cards (id, title, subtitle, price, tag, image_url, category_link)
VALUES
('primary-deal', 'Royal Chicken Dum Biryani', 'Slow-steamed in copper handi with saffron & house spices', 'Rs. 650', '🌟 TODAY''S CHEF SPECIAL', '/food-biryani.jpg', 'Biryani & Rice')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, price = EXCLUDED.price;

-- 9. Legacy Mock Cleanup
DELETE FROM cash_shifts WHERE id IN ('sh-yesterday-1', 'sh-yesterday-2');

-- 10. Cash Shifts Seed (Clean Initial Drawer - Zero Mock Collections)
INSERT INTO cash_shifts (
    id, cashier_id, cashier_name, branch_id, opened_at, closed_at,
    opening_float, cash_collected, expected_cash, counted_cash, difference, difference_reason, status
) VALUES
(
    'sh-today-1',
    'user-cashier',
    'Bilal Farooq',
    'gulberg-lahore',
    CURRENT_TIMESTAMP,
    NULL,
    0,
    0,
    0,
    NULL,
    NULL,
    NULL,
    'open'
),
(
    'sh-today-isb',
    'user-cashier-isb',
    'Hamza Tariq',
    'f7-islamabad',
    CURRENT_TIMESTAMP,
    NULL,
    0,
    0,
    0,
    NULL,
    NULL,
    NULL,
    'open'
),
(
    'sh-today-khi',
    'user-cashier-khi',
    'Adeel Murtaza',
    'clifton-karachi',
    CURRENT_TIMESTAMP,
    NULL,
    0,
    0,
    0,
    NULL,
    NULL,
    NULL,
    'open'
)
ON CONFLICT (id) DO UPDATE SET
    opening_float = 0,
    cash_collected = 0,
    expected_cash = 0,
    status = 'open';

-- 11. Announcements & Real Info Seed
INSERT INTO announcements (
    id, title, tag, description, valid_until, branch_id, branch_name, discount_percent, badge_color
) VALUES
(
    'ann-1',
    'Midnight Biryani & Karahi Feast: Flat 20% Off',
    'HOT DEAL',
    'Enjoy 20% off all Mutton & Chicken Karahi orders between 10:00 PM and 2:00 AM across all branches.',
    'Tonight 02:00 AM',
    NULL,
    NULL,
    20,
    '#EF4444'
),
(
    'ann-2',
    'Gulberg Rooftop Terrace Live BBQ Night',
    'BRANCH SPECIAL',
    'Join us on the Gulberg Rooftop for live open-flame charcoal Seekh Kababs & Mutton Chops every Friday & Saturday.',
    'Every Weekend',
    'gulberg-lahore',
    'Gulberg Lahore',
    NULL,
    '#F59E0B'
),
(
    'ann-3',
    'Free Delivery on Doorstep Orders above Rs. 1500',
    'ANNOUNCEMENT',
    'Zero delivery fee on all online delivery orders exceeding Rs. 1500 via the mobile app.',
    'Valid this Month',
    NULL,
    NULL,
    NULL,
    '#10B981'
)
ON CONFLICT (id) DO NOTHING;

