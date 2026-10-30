-- ============================================================================
-- FoodiesCafe PostgreSQL Database Seed Data (seed.sql)
-- Initial master data for branches, menu items, users, tables, and settings
-- ============================================================================

-- 1. Branches Seed
INSERT INTO branches (id, name, city, address, phone, opening_hours, is_open, is_busy, prep_time_estimate_min, full_edit_window_min, stop_add_ons_min_before_ready, delivery_enabled, max_order_distance_km, table_qr_max_distance_meters, payment_settings)
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
('cat-2', 'Shinwari & Karahi', 2),
('cat-3', 'Burgers & Fast Food', 3),
('cat-4', 'Tandoor & Breads', 4),
('cat-5', 'Beverages & Desserts', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, display_order = EXCLUDED.display_order;

-- 3. Users Seed
INSERT INTO users (id, name, phone, email, address, role, branch_id, status, no_show_count, password_hash, rider_availability, rider_total_deliveries, rider_active_order_id)
VALUES
('user-cust', 'Zeeshan Ahmed', '+92 301 5551234', 'zeeshan@example.com', 'House 14, Street 9, Model Town, Lahore', 'customer', NULL, 'active', 0, 'password123', NULL, 0, NULL),
('user-owner', 'Malik Jahangir', '+92 300 0000001', 'owner@foodiescafe.pk', NULL, 'platform_owner', NULL, 'active', 0, 'password123', NULL, 0, NULL),
('user-bm', 'Rashid Mehmood', '+92 300 2223344', 'manager.gulberg@foodiescafe.pk', NULL, 'branch_manager', 'gulberg-lahore', 'active', 0, 'password123', NULL, 0, NULL),
('user-rep', 'Zara Noor', '+92 300 4445566', 'rep.gulberg@foodiescafe.pk', NULL, 'branch_representative', 'gulberg-lahore', 'active', 0, 'password123', NULL, 0, NULL),
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
('user-rep-isb', 'Ayesha Siddiqui', '+92 300 3335544', 'rep.islamabad@foodiescafe.pk', NULL, 'branch_representative', 'f7-islamabad', 'active', 0, 'password123', NULL, 0, NULL),
-- Karachi Staff
('user-bm-khi', 'Kamran Siddiqui', '+92 300 5556677', 'manager.karachi@foodiescafe.pk', NULL, 'branch_manager', 'clifton-karachi', 'active', 0, 'password123', NULL, 0, NULL),
('user-cashier-khi', 'Saad Ali', '+92 300 5558899', 'cashier.karachi@foodiescafe.pk', NULL, 'cashier', 'clifton-karachi', 'active', 0, 'password123', NULL, 0, NULL),
('user-kitchen-khi', 'Chef Zakir Hussain', '+92 300 5557766', 'kitchen.karachi@foodiescafe.pk', NULL, 'kitchen_staff', 'clifton-karachi', 'active', 0, 'password123', NULL, 0, NULL),
('user-floor-khi', 'Rizwan Ahmed', '+92 300 5556655', 'floor.karachi@foodiescafe.pk', NULL, 'floor_staff', 'clifton-karachi', 'active', 0, 'password123', NULL, 0, NULL),
('user-rep-khi', 'Mahnoor Baloch', '+92 300 5555544', 'rep.karachi@foodiescafe.pk', NULL, 'branch_representative', 'clifton-karachi', 'active', 0, 'password123', NULL, 0, NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, branch_id = EXCLUDED.branch_id, password_hash = EXCLUDED.password_hash, rider_availability = COALESCE(users.rider_availability, EXCLUDED.rider_availability);

-- 4. Menu Items Seed
INSERT INTO menu_items (id, name, category, description, base_price, image, is_available, branch_availability, sizes, extras)
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
    '[{"name":"Regular (Single)","priceDelta":0},{"name":"Jumbo (Double)","priceDelta":350}]'::jsonb,
    '[{"name":"Extra Zeera Raita","price":60},{"name":"Fresh Kachumber Salad","price":70},{"name":"Extra Boiled Egg","price":50}]'::jsonb
),
(
    'm2',
    'Desi Ghee Shinwari Chicken Karahi',
    'Shinwari & Karahi',
    'Fresh country chicken wok-tossed in pure organic desi ghee, ripe tomatoes, coarse crushed black pepper and ginger juliennes.',
    1250,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":true,"clifton-karachi":true}'::jsonb,
    '[{"name":"Half (serves 2)","priceDelta":0},{"name":"Full (serves 4)","priceDelta":1100}]'::jsonb,
    '[{"name":"Roghni Naan","price":80},{"name":"Garlic Butter Naan","price":110},{"name":"Mint Chutney","price":50}]'::jsonb
),
(
    'm3',
    'Smoky Beef Seekh Kebabs (4 Pcs)',
    'Shinwari & Karahi',
    'Melt-in-mouth prime beef mince seasoned with roasted cumin, brown onion paste, coriander seeds and charcoal grilled over hot embers.',
    780,
    '/hero-bg.jpg',
    true,
    '{"gulberg-lahore":true,"f7-islamabad":false,"clifton-karachi":true}'::jsonb,
    '[{"name":"Standard (4 pcs)","priceDelta":0},{"name":"Platter (8 pcs)","priceDelta":680}]'::jsonb,
    '[{"name":"Tandoori Paratha","price":90},{"name":"Mint Coriander Dip","price":40}]'::jsonb
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
    '[{"name":"Single Fillet","priceDelta":0},{"name":"Double Monster Fillet","priceDelta":280}]'::jsonb,
    '[{"name":"Seasoned Masala Fries","price":160},{"name":"Cheese Dip Shot","price":90}]'::jsonb
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
    false,
    '{"gulberg-lahore":false,"f7-islamabad":false,"clifton-karachi":true}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    base_price = EXCLUDED.base_price,
    description = EXCLUDED.description,
    is_available = EXCLUDED.is_available,
    branch_availability = EXCLUDED.branch_availability;

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
('b-2', 'Royal Handi & Desi Ghee Shinwari Karahi', 'Tender mutton & chicken simmered in copper handis with freshly crushed peppercorns and pure organic butter.', '🔥 Chef Handi Special', '/food-biryani.jpg', 'Shinwari & Karahi', true, 2),
('b-3', 'Juicy Gourmet Smash Burgers & Loaded Fries', 'Crispy seasoned fillets & smashed patties layered with molten cheddar, house pickles, and brioche buns.', '🍔 Signature Fast-Casual Bites', '/hero-bg.jpg', 'Burgers & Fast Food', true, 3),
('b-4', 'Traditional Tandoor Naans & Cold Refreshers', 'Garlic butter naans, roghni naans, artisanal mint margaritas, and slow-brewed Karak Chai.', '❄️ Drinks & Fresh Breads', '/food-biryani.jpg', 'Beverages & Desserts', true, 4)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, image_url = EXCLUDED.image_url;

-- 8. Deals Seed
INSERT INTO deal_cards (id, title, subtitle, price, tag, image_url, category_link)
VALUES
('primary-deal', 'Royal Chicken Dum Biryani', 'Slow-steamed in copper handi with saffron & house spices', 'Rs. 650', '🌟 TODAY''S CHEF SPECIAL', '/food-biryani.jpg', 'Biryani & Rice')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, price = EXCLUDED.price;

-- 9. Clean Purge of Legacy Mock Orders, Refunds, and Sessions
DELETE FROM refund_requests WHERE id LIKE 'ref-%' OR id LIKE 'ref-pending-%' OR id LIKE 'ref-approved-%';
DELETE FROM table_sessions WHERE id LIKE 'sess-%';
DELETE FROM orders WHERE id LIKE 'ord-seed-%' OR order_number IN ('FC-6744', 'FC-7819', 'FC-8812', 'FC-9021');
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
)
ON CONFLICT (id) DO UPDATE SET
    opening_float = 0,
    cash_collected = 0,
    expected_cash = 0,
    status = 'open';

-- 11. Refund Requests Seed (Clean initial state - zero dummy refund requests)
-- Real refund requests are created when submitted by customers or staff.

-- 12. Table Sessions Seed (Clean initial state - all tables free and available)
-- Real table sessions are recorded when guests are seated at tables.

