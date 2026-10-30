# FoodiesCafe — Complete Project Architecture & Progress Highlights (`highlight.md`)

> **Note for AI Models & Developers**:  
> Read this document first when starting a new conversation or resuming work on FoodiesCafe. It captures 100% of the implemented features, UI behaviors, user-specified constraints, business workflows, component hierarchies, and architectural patterns.

---

## 1. Project Overview & Technology Stack

- **Project**: FoodiesCafe Multi-Branch Restaurant & Real-Time Ordering System (Pakistan: Gulberg Lahore, F-7 Islamabad, Clifton Karachi).
- **Core Framework**: **Next.js 16 (App Router with Turbopack)**, **React 19**, **TypeScript**.
- **Styling**: Pure Vanilla CSS design tokens (`globals.css`) with curated light mode color variables (`--primary`, `--primary-glow`, `--bg-main`, `--bg-card`, `--border-color`, etc.).
- **Theme Rule**: **Strict Pure Light Mode**. No dark mode toggles or dark theme styles.
- **Iconography**: Lucide React (`lucide-react`).
- **Dev Server**: Running on port `3000` (`npm run dev`).
  - **Customer Portal**: `http://localhost:3000`
  - **Staff Operations Portal**: `http://localhost:3000/staff`

---

## 2. Directory Structure & Key Files

```
FoodiesCafe/
├── package.json                             # Root proxy package.json (dev, build, start, db:init)
├── .env.example                             # PostgreSQL environment variables template
├── FoodiesCafe_Requirements.md              # Original requirements & specs
├── FoodiesCafe — Product Requirements Document (PRD).md
├── highlight.md                             # Master documentation & progress record
├── database/                                # PostgreSQL Database Layer
│   ├── schema.sql                           # 14 Relational tables & indexes (orders, shifts, menu, tables, etc.)
│   └── seed.sql                             # Master seed data for branches, menu, tables, initial shift
└── app/
    ├── package.json
    ├── .env.example
    ├── next.config.ts
    ├── tsconfig.json
    ├── scripts/
    │   └── init-db.js                       # Standalone node script to initialize PostgreSQL
    ├── public/
    │   ├── logo.png                         # Official cafe logo (used for branding & card watermarks)
    │   ├── hero-bg.jpg                      # Dining ambience hero banner
    │   └── food-biryani.jpg                 # Signature Dum Biryani photo
    └── src/
        ├── app/
        │   ├── layout.tsx                   # Root HTML layout with AppProvider & Outfit/Plus Jakarta Sans fonts
        │   ├── page.tsx                     # Customer Web Application entrypoint
        │   ├── globals.css                  # Global design tokens & print stylesheets
        │   ├── api/                         # PostgreSQL REST API routes
        │   │   ├── db/status/route.ts       # Health check & init trigger
        │   │   ├── branches/route.ts        # Branches endpoint
        │   │   ├── complaints/route.ts      # Support tickets & chat messages endpoint
        │   │   ├── marketing/route.ts       # Banners & deal approvals endpoint
        │   │   ├── menu/route.ts            # Menu items & categories endpoint
        │   │   ├── orders/route.ts          # Orders CRUD & lifecycle updates endpoint
        │   │   ├── refunds/route.ts         # Refund requests & approvals endpoint
        │   │   ├── shifts/route.ts          # Cashier shifts & till drawer endpoint
        │   │   └── tables/                  # Table seating & active sessions endpoints
        │   │       ├── route.ts             # Tables status & PINs
        │   │       └── sessions/route.ts    # Table dine-in sessions
        │   └── staff/
        │       └── page.tsx                 # Staff Management Portal entrypoint & screen router
        ├── lib/
        │   └── db.ts                        # Dual-engine PostgreSQL client (Real PG + pg-mem fallback)
        ├── context/
        │   └── AppContext.tsx               # Central application state, live polling & BroadcastChannel sync
        ├── types/
        │   └── cafe.ts                      # Full TypeScript interfaces & data contracts
        ├── customer/                        # STRICTLY ISOLATED CUSTOMER PORTAL
        │   ├── CustomerHeader.tsx           # 72px fixed header with branch selector & search
        │   ├── CustomerLoginModal.tsx       # Dedicated Email Verification Code modal with logo watermark & Resend API setup guide
        │   ├── MarketingHome.tsx            # Visual home screen with 2s carousel & deals
        │   ├── CustomerMenu.tsx             # 2-col dishes grid, sticky category bar & statically pinned checkout card
        │   ├── CustomerCheckout.tsx         # Multi-option checkout modal (Dine-In, Takeaway, Delivery, Payment)
        │   ├── CustomerFloorSeatingModal.tsx# Visual table selection (free tables only)
        │   ├── CustomerTableQR.tsx          # QR table code reader for dine-in seating
        │   ├── CustomerTracking.tsx         # Real-time order progress tracker
        │   ├── CustomerOrderEdit.tsx        # Stage-1 order amendment screen
        │   ├── CustomerHistory.tsx          # Order history cards, reorder button & isolated receipt print
        │   ├── CustomerSupport.tsx          # Ticket & inquiries submission, real-time chat with support
        │   ├── CustomerProfile.tsx          # Profile details & notification preferences
        │   └── ItemDetailModal.tsx          # Customizer / confirmation pop-up
        ├── staff/                           # STRICTLY ISOLATED STAFF PORTAL
        │   ├── StaffAuth.tsx                # Staff sign in & role switcher portal
        │   ├── StaffLayout.tsx              # Sidebar, role switcher, top navigation (60px header)
        │   ├── OwnerOverview.tsx            # Platform Owner financial & operational KPIs
        │   ├── BranchesAndStaff.tsx         # Multi-branch configuration & staff account management
        │   ├── BranchManagerDashboard.tsx   # Branch Manager overview & operational monitors
        │   ├── MenuAndPrices.tsx            # Menu editor, categories, banners, deals, approvals
        │   ├── KitchenQueue.tsx             # Kitchen KDS queue with dish availability toggles
        │   ├── CashierDesk.tsx              # Cashier Desk, till reconciliation & walk-in ordering
        │   ├── CashierOrders.tsx            # Cashier Orders Hub (Dine-In, Takeaway, Delivery)
        │   ├── FloorTables.tsx              # Dine-in floor map, table PIN generator & waiter delivery
        │   ├── RepresentativeInbox.tsx      # Customer Support workspace (Inquiries chat & Ready orders)
        │   ├── ReportsAndReconciliation.tsx # Financial reports & till drawer cash logs
        │   ├── AuditLogView.tsx             # System-wide audit log trail
        │   └── CustomersAndOrders.tsx       # Central customer records & order archives
        └── components/
            └── common/
                ├── ToastContainer.tsx       # Dynamic toast notifications positioned at top: 72px
                ├── Interactive3DCard.tsx    # 3D interactive tilting card
                └── ModalConfirmation.tsx    # Reusable confirmation dialogs
```

---

## 3. Comprehensive Feature-by-Feature Documentation

### A. Customer Header (`src/customer/CustomerHeader.tsx`)
1. **Dimensions & Positioning**:
   - Fixed `height: 72px` with `boxSizing: 'border-box'`, `position: sticky`, `top: 0`, `zIndex: 1000`.
   - Backdrop filter blur with solid card background and clean bottom border.
   - `overflowX: 'hidden'`, `maxWidth: '100vw'`: Screen never scrolls horizontally to left or right.
2. **Branding**:
   - Clean, bold `FoodiesCafe` typography with responsive fluid font size (`clamp(17px, 4.5vw, 22px)`).
   - Removed logo picture before cafe name and removed `"Eat Fresh & Healthy"` subtitle for a modern, uncluttered look.
3. **Controls & Navigation**:
   - **Hamburger Menu (☰)**: Opens the unscrollable slide-out navigation drawer.
   - **Branch Selector**: Located on the right side before the search bar and cart. Honors manual selection and persists to `localStorage`.
   - **Header Search Bar**: Live search input with instant filtering across all dishes, navigating automatically to the Menu view.
   - **Cart Button**: Fixed width with counter badge so that adding items never causes header displacement or horizontal jumping.
4. **Header Progressive Responsive Removal**:
   - **Step 1 (width <= 1024px)**: Search bar is removed FIRST (`.header-search-container { display: none !important; }`).
   - **Step 2 (width <= 768px)**: Profile/account button is removed SECOND (`.header-profile-button { display: none !important; }`).
   - **Step 3 (width <= 540px)**: Branch location selector is removed THIRD (`.header-location-selector { display: none !important; }`).
   - **Smallest Screens (< 540px)**: Keep ONLY slide bar (☰), cafe name (`FoodiesCafe`), and cart option with zero horizontal scroll.
5. **Vertical Left Alignment Guarantee**:
   - The left slide sign / hamburger menu button (`☰`) remains strictly aligned in the **exact same vertical line from the left** with the bottom content items and cards across all viewports (`padding-left: 20px` desktop, `12px` mobile <= 640px, `8px` <= 360px).
6. **Slide-Out Navigation Drawer (☰)**:
   - Fits the viewport without scrolling (`overflow: 'hidden'`).
   - Profile header displays avatar in line horizontally with account name and phone number. Clicking it opens the Profile Popup Screen.
   - Menu options order: **Order Menu**, **Track My Order**, **Order History**.
   - Dedicated footer action button: **"Help & Contact Cafe — Chat with cafe staff"**.
   - Removed branch information, top help button, and view profile link from drawer.
7. **Customer Profile Popup**:
   - Self-contained modal displaying profile information with editable Full Name, Phone, and Email.
   - Features an instant "Save Changes" button and places the **"Sign Out"** button at the very last row.

---

### B. Customer Authentication (`src/customer/CustomerLoginModal.tsx` & Header Flow)
1. **Simplified Name + Phone + SMS OTP Flow**:
   - **No Registration Option**: Completely removed registration forms, passwords, and redirect links ("Don't have an account? Register").
   - **Step 1 (Credentials)**: Customer inputs Full Name and Pakistani Mobile Number (`+92`).
   - **Step 2 (Verification)**: System sends a 4-digit SMS OTP code (simulated with a demo banner). The customer confirms the code and is instantly signed in.
2. **Card Visual Appearance**:
   - The white card background is replaced with the official cafe logo (`/logo.png`) adjusted to fit the card dimensions (`maxWidth: 410px`), with a translucent white overlay for maximum contrast and legibility.
   - Removed any external photos from behind the card.

---

### C. Customer Home Page & Responsive Footer (`src/customer/MarketingHome.tsx`)
1. **Hero Carousel & Fluid Responsiveness**:
   - High-resolution banners auto-transition every **2 seconds** (`2000ms`).
   - Left and right arrow buttons (`<` and `>`) removed for a seamless experience.
   - Removed the secondary "Clickable Menu Highlights" slider and the "CASH ONLY" hero banner.
   - All grids use `minmax(min(280px, 100%), 1fr)` and clamp sizing; screen never scrolls horizontally on any device.
2. **Direct Dish Redirection to Menu**:
   - Clicking any featured dish card or Chef's Deal navigates directly to that item in the Menu page (`foodies_target_item` stored in `localStorage`).
   - Removed all modal popups, price tags, and add-to-cart buttons from the Home screen. Dish cards display purely appetizing photography, category badge, and dish title.
3. **Menu Auto-Scroll & Highlight**:
   - When navigated from the Home page, the Menu page automatically selects the matching category, smooth-scrolls to center that dish, and triggers a pulse highlight animation (`highlight-target-dish`).
4. **Floating "Order Now" Button**:
   - Cheezious-style floating action button fixed at bottom-right (`bottom: 28px, right: 28px`, mobile `bottom: 20px, right: 16px`) on the Home page only.
5. **Responsive Footer & Branch Location Removal**:
   - Footer text shrinks dynamically using fluid typography (`clamp()`) as the screen shrinks while maintaining its structured multi-column pattern.
   - At the exact screen size where the desktop checkout card disappears (`<= 860px`), the **Branch Locations** column is removed (`display: none !important`), freeing up space for the other footer elements.

---

### D. Customer Order Menu (`src/customer/CustomerMenu.tsx`)
1. **Progressive Breakdown & Responsive Shrinking**:
   - **Desktop Wide (`>1200px`)**: **3 items per row** (`repeat(3, minmax(0, 1fr))`) + right-side static checkout card (350px).
   - **Intermediate Desktop (`861px - 1200px`)**: First removes the **3rd card of item** (2 items in row) and shrinks the rest of the 2 cards and the checkout card (`clamp(260px, 27vw, 320px)`).
   - **Tablet / Phone Transition (`<= 860px`)**: When area is constrained, the checkout card is completely removed (`display: none !important`), and the **2 item cards expand into the full space and shrink fluidly** as the screen boundaries touch them.
   - **Mobile Level (`<= 640px`)**:
     - All extra text from the item card is removed other than the **dish name** (category badge on image, description, and "Price (Cash)" label are hidden).
     - Below the dish name is the **price** (e.g. `Rs. 450`).
     - In the **same row as the price**, the **Order** button is displayed.
     - When selected / added to cart, the order option displays: **delete sign (`Trash2`)**, **quantity number**, and **plus sign (`Plus`)** in a compact row without wrapping.
2. **Sticky Category Bar, Small-Screen Static Positioning & Horizontal Auto-Scroll**:
   - **"All" Removed from Categories**: The generic "All" category tab has been completely removed. The category bar strictly displays authentic food categories (Appetizers, Burgers, Pizza, Desi Karahi, Desserts, Beverages), defaulting cleanly to the first category (`Appetizers`).
   - **Horizontal Auto-Scroll on Vertical Menu Scroll**: When the customer scrolls down through dishes, ScrollSpy updates the active category. A dedicated effect computes the button's offset relative to the category bar and automatically smooth-scrolls the row (`row.scrollTo({ left: target, behavior: 'smooth' })`) from left to right. The active category pill is always brought onto the screen and centered, rather than staying off-screen while only its color changes.
   - Pinned on a full horizontal line directly below the 72px fixed header (`position: sticky; top: 72px; z-index: 900`).
   - **Zero Initial Jump Guarantee**: On small screens (`<= 860px` and `<= 640px`), `.foodies-menu-container` has `padding-top: 0 !important` and `.foodies-category-bar-full-line` has `margin-top: 0 !important; top: 72px !important;`. The category options start immediately at `top: 72px` flush under the header at initial load (`scrollY = 0`), so they **never jump or shift upward** when scrolling begins.
   - Opaque background prevents scrolling dishes from showing through.
   - Section headers configure `scrollMarginTop: '128px'` and ScrollSpy threshold at `135px` for smooth active pill tracking.
3. **Static Desktop Checkout Card & Bottom Scroll Boundary**:
   - Positioned cleanly below the header and categories (`position: sticky; top: 126px; z-index: 850; width: 350px`).
   - **Height & Vertical Anchoring**: Fixed at `height: 520px` with `maxHeight: calc(100vh - 146px)`. The internal body (`overflow-y: auto`) scrolls independently while header and footer stay pinned.
   - **Bottom Scroll Stopping Rule**: Container bottom padding is set to `20px` (`cartCount > 0 ? '80px' : '20px'` on mobile). When the customer scrolls down to the last menu item, the scroll stops as soon as the bottom of the last card is cleanly displayed above the bottom of the screen. The checkout card is never pulled upward and remains firmly static at `top: 126px`.
4. **Mobile Floating Checkout Bar**:
   - On screens `<= 860px`, the right-side card is hidden (`display: none !important`).
   - When `cartCount > 0`, a floating checkout bar appears docked at the screen bottom displaying item count, subtotal, and "Proceed to Checkout" button. When `cartCount === 0`, bottom padding resets to `20px` so the last card stops cleanly at the viewport bottom.

---

### E. Customer Checkout Flow (`src/customer/CustomerCheckout.tsx`)
1. **Order Review First & Empty Cart Direct Navigation**:
   - When the customer opens checkout/cart, the modal always starts on **Order Review** (`order_review`) rather than asking for login first.
   - If the cart is empty (`cartCount === 0`) and the customer clicks the Cart option from the header, it automatically navigates directly to menu items (`onNavigate('menu')`) and closes any open login modal, instead of opening checkout and prompting for authentication.
   - Displays an itemized list of selected items, line totals, quantity controls (`Trash2` when quantity is 1, `Minus` when > 1, `Plus`), and the subtotal payable.
   - Clicking **"Add More Items"** closes the drawer and navigates to the menu.
   - Clicking **"Proceed to Checkout"** initiates fulfillment for logged-in users, or opens the Customer Sign In screen for guests.
2. **Checkout Sign In Screen (Exact Customer Sign In Modal Design)**:
   - When an unauthenticated user clicks "Proceed to Checkout", the login screen that appears is identical in design to `CustomerLoginModal`:
     - Watermark background of the official cafe logo (`opacity: 0.22`).
     - Foodies Cafe logo inside a white rounded container with subtle border and shadow.
     - Centered heading **"Sign In"** with subtitle *"Sign in with your name and mobile number"*.
     - Full Name input with `<User size={16} color="var(--primary)" />` icon.
     - Pakistani Mobile Number input with `🇵🇰 +92` prefix.
     - Action button **"Send SMS Code"** styled with black text (`#000000`, `fontWeight: 600`), primary orange background, and `ArrowRight` icon.
     - SMS OTP Confirmation step with Demo SMS Code banner (`5829`), 4-digit code input, and **"Confirm & Sign In"** button with black text (`#000000`, `fontWeight: 600`).
     - Upon confirmation, sets `currentUser`, saves to `localStorage`, displays a success toast, and transitions smoothly into the fulfillment order options step with all cart items intact.
3. **Consistent Dimensions Across All Steps & Clean Bottom Card Fit**:
   - Pop-up for order details review (`order_review`),
   - Pop-up for guest sign-in (`auth`),
   - Pop-up for order type selection (`fulfillment`: Dine-In, Takeaway, Delivery),
   - Pop-up for Dine-In floor and table selection (`details`),
   - Pop-up for Takeaway pickup timing and instructions (`details`),
   - Pop-up for Delivery address and landmark notes (`details`),
   - Pop-up for payment methods (`payment`),
   - ALL share the exact same static modal width (`maxWidth: 540px`), with `height: 'auto'` and `maxHeight: 94vh`.
   - The outer modal card snugly wraps the action buttons, completely eliminating any empty card bottom space below the buttons.
4. **Takeaway "Schedule Later" Input Box**:
   - When the customer selects "Schedule Later", the schedule box transforms into a special instruction and time input textarea within the standard card container.
5. **Static Equal Size Payment Modal with Scrollable Methods (Stage 3)**:
   - When the payment section pop-up appears, the outer card size **remains equal to earlier checkout cards** (`maxWidth: 540px`).
   - If payment methods exceed the container space (e.g., Cash/COD, Mobile Wallets, Cards, Bank Transfer, BNPL Installments), the payment methods list inside that card is scrollable (`maxHeight: 270px; overflowY: auto; paddingRight: 4px`), while the card dimensions and position remain static.
6. **Manager-Controlled Payment Modes & 3-Month Installments**:
   - Configurable per branch by the manager: Cash / COD, Mobile Wallets (JazzCash/Easypaisa), Cards (Visa/Mastercard/PayPak), Bank Transfer (Raast/IBAN).
   - **3-Month Installments (BNPL)**: Displayed **only if enabled by the branch manager** for that order option. Displays 3 equal monthly payments of Rs. Total/3 with 0% markup.

---

### F. Floor Seating & Table Selection (`src/customer/CustomerFloorSeatingModal.tsx`)
1. **Free Tables Only**:
   - Customers can only see and select available tables (`status === 'available'`) for each floor.
   - Each table displays strictly its table number (e.g. `T-01`), with no chair counters or internal capacity text.
2. **Zero Edit Tools**:
   - Table editors, chair increment/decrement controls, floor configuration forms, and delete buttons are completely absent from the customer interface.

---

### G. Order History, Reordering & Isolated Printing (`src/customer/CustomerHistory.tsx`)
1. **Order History Cards**:
   - Removed the words "Full Receipt" from history list cards.
   - Replaced plain card background color with the official cafe logo (`/logo.png`) rotated at 45 degrees, sized to the card dimensions.
2. **Order Detail Receipt**:
   - Replaced "Full Itemized Receipt" text with a functional **"Reorder"** button (`handleReorder`) that adds all items from that past order into the active cart and navigates to the Menu.
   - Displays the 45-degree cafe logo watermark background.
3. **Strictly Isolated Receipt Printing**:
   - Dedicated print button at the top right of the receipt card triggers `handlePrintReceipt`.
   - Clones `#printable-order-receipt` into a dedicated hidden iframe and triggers native print exclusively on the receipt element, completely preventing the rest of the application, headers, or background elements from printing.
   - Global `@media print` rules in `globals.css` hide the customer header, sidebar, toast containers, and non-receipt elements during print.

---

### H. Global Toast Notifications (`src/components/common/ToastContainer.tsx`)
1. **Positioning Directly Below Header**:
   - Positioned at `position: fixed`, `top: 72px`, `right: 24px`, `zIndex: 999999`.
   - The top edge of every notification aligns directly with the bottom border line of the 72px sticky header across all customer and staff pages.
   - Does not overlap or obscure header controls.
2. **Notification Cleanup**:
   - Removed the duplicate header popup notification (`cartPopup`).
   - All cart actions, order status changes, and OTP notifications route through the standardized `ToastContainer`.

---

### I. Staff Operations Portal (`src/staff/`)
1. **Strictly Isolated Staff Layout (`StaffLayout.tsx`)**:
   - Complete operational dashboard with dedicated sidebar navigation and role switcher.
   - Supported Roles: `platform_owner`, `branch_manager`, `branch_representative`, `kitchen_staff`, `cashier`, `floor_staff`, `delivery_staff`.
   - **Header Layout**: "Customer Storefront" button removed from staff top header.
   - **Staff Badge & Clean Name at End of Header**: Positioned at the very end (far right) of the header. Staff role/status badge (`var(--primary-light)` pill) is displayed **before** the staff member's name. Any bracketed role text (such as `(Manager)` or `(Branch Manager)`) is automatically stripped using `.replace(/\s*\(.*?\)/g, '').trim()`, displaying only the clean name.
2. **Kitchen KDS & Order Kanban Queue (`KitchenQueue.tsx` / `KitchenKDS.tsx`)**:
   - Real-time kitchen display showing incoming orders, items, preparation stages, and elapsed timers.
   - **4-Column Order Progression Cards**:
     - `Incoming Orders` (`placed` / `accepted`): Kitchen reviews ticket details; clicking "Start Preparing" transitions order to `preparing` and moves it to the "Now Preparing" cards column.
     - `Now Preparing` (`preparing`): Chefs prepare food; clicking "Mark Ready" transitions order to `ready` and moves it to the "Ready for Service" cards column.
     - `Ready for Service` (`ready`): Hot food is plated; clicking "Mark to Serve (Send to Waiter)" transitions status to `served` and moves the card to "Sent to Waiter" column.
     - `Sent to Waiter` (`served`): Order card immediately dispatches to the Waiter / Floor representative dashboard.
   - **Dish Availability & Out-of-Stock Management**:
     - Direct modal trigger from kitchen top bar: "Dish Availability & Stock".
     - Displays live branch menu dishes with instant status indicators ("In Stock" vs "Unavailable").
     - Kitchen staff can mark an item unavailable with 1 click when stock or ingredients run out.
     - When restocked, staff clicks "Remove Unavailable Status" to immediately restore item availability across the entire cafe catalog.
     - Live counter badge in the kitchen top header highlights count of currently unavailable items.
   - **Authentic 80mm KOT Ticket Printing with 135° Watermark**:
     - Kitchen Order Ticket (KOT) print button triggers an isolated 80mm thermal receipt iframe.
     - Displays official cafe logo (`/logo.png`) rotated at 135° (`transform: rotate(135deg); opacity: 0.16;`) in place of a plain white background, eliminating all browser header/footer margins.
3. **Cashier Billing & Desk (`CashierBilling.tsx` / `CashierDesk.tsx`)**:
   - Counter point-of-sale register, cash collection, Raast QR verification, and printed receipt generation.
   - **Itemized Receipt Printing with 135° Logo Watermark**: Dedicated "Print Receipt" button in the order preview triggers an isolated 80mm thermal receipt iframe with the official cafe logo rotated at 135° in place of a plain white background, matching customer history receipts.
   - On-screen receipt preview card also features the subtle 135° rotated logo watermark.
4. **Floor Tables & Waiter Dashboard (`FloorTables.tsx`)**:
   - Visual floor management, table status toggling (Available, Occupied, Reserved), and 4-digit table QR PIN generator.
   - **Dedicated Waiter / Server Orders Panel**: "Orders Ready for Server / Waiter" panel tracks orders marked `ready` and `served`.
   - Displays customer name, table number (e.g., `Table T-03`), order type, and item count.
   - Waiter action button **"Mark Delivered & Served to Table ✓"** transitions order to `completed`, removes it from the pending server queue, and triggers a real-time toast notification.
5. **Rider Dispatch (`RiderDispatch.tsx`)**:
   - Delivery queue, driver assignment, customer address details, and dispatch status tracking.
6. **Menu & Pricing Editor (`MenuAndPrices.tsx`)**:
   - Dish catalog manager, per-branch availability toggles, per-branch price overrides, and photo URL manager.
   - Hero banner and Chef's Deal editor with manager approval workflows.
7. **Representative Inbox & Support (`RepresentativeInbox.tsx`)**:
   - Live customer ticket inbox, inquiry resolution, and chat responses.
8. **Analytics Dashboard (`AnalyticsDashboard.tsx`)**:
   - Revenue reporting, order volume breakdown, popular items, and fulfillment type analytics per branch.
9. **Staff Authentication Portal (`StaffAuth.tsx`)**:
   - Designed with the exact visual language of the customer login modal (pure light mode, 24px rounded card, official cafe logo watermark background, Foodies logo header square, and bold "Sign In" heading).
   - Strictly inputs **Email or Phone Number** and **Password** with **zero SMS confirmation steps**.
   - Features 1-tap quick role demo pills (Manager, Kitchen, Cashier, Floor, Support, Owner) for fast testing and role switching.
   - Submitting immediately authenticates and routes to the designated operational dashboard.

---

### J. PostgreSQL Database Architecture & Next.js Integration
1. **Schema Definition (`database/schema.sql`)**:
   - 14 relational tables: `branches`, `users`, `categories`, `menu_items`, `tables`, `orders`, `complaints`, `cash_shifts`, `refund_requests`, `audit_logs`, `hero_banners`, `deal_cards`, `banner_deal_approval_requests`, `footer_settings`.
   - Production-grade constraints, foreign keys with cascade/set null rules, and indexed query paths (`phone`, `branch_id`, `role`, `status`, `customer_id`, `created_at`).
   - JSONB support for complex nested structures (custom options, sizes, branch availability, per-branch price overrides, payment settings).
2. **Master Seed Data (`database/seed.sql`)**:
   - Initial master records for all 3 Pakistani branches (Lahore, Islamabad, Karachi), authentic menu items (Biryani, Shinwari Karahi, Burgers, Naans, Qahwa), table layouts with PINs, staff users, hero banners, and branch settings.
3. **Database Client Pool (`src/lib/db.ts`)**:
   - High-performance connection pool with singleton caching for Turbopack hot reload.
   - Automatically supports `DATABASE_URL` (Supabase, Neon, AWS RDS, Docker/Podman) or discrete connection variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`).
   - Built-in `testConnection()` and `initDatabase()` routines.
4. **RESTful Database API Endpoints (`src/app/api/`)**:
   - `/api/db/status` (GET health check & status, POST run schema/seed initialization).
   - `/api/branches` (GET all branches, PATCH branch operational settings & payment settings).
   - `/api/menu` (GET dishes & categories, PATCH dish availability & price overrides).
   - `/api/orders` (GET orders with branch/customer filtering, POST create order, PATCH order/payment status).
   - `/api/tables` (GET tables by branch, PATCH table status & reservation).
5. **Bidirectional State Synchronization (`AppContext.tsx`)**:
   - Hydrates state from PostgreSQL database on mount.
   - Non-blocking asynchronous database synchronization on all customer and staff mutations (`placeOrder`, `updateOrderStatus`, `recordCashPayment`, `updateTableStatus`, `updateMenuItemPrice`, `updateBranchSettings`).
   - Graceful offline fallback to client state and `localStorage` so the UI remains 100% responsive and operational.
6. **Initialization Scripts**:
   - `npm run db:init` / `npm --prefix app run db:init` (runs `app/scripts/init-db.js`).

---

## 4. Key Rules to Remember for Future Work (Never Violate)

1. **Pure Light Mode**: Never introduce dark mode styles or toggle switches. Keep all components in pure light mode.
2. **No "KFC" Mentions**: Do not use the word "KFC" anywhere in customer or staff copy.
3. **Home Page Redirection**: Home page dish/deal cards navigate directly to that item in Menu (`foodies_target_item`); no modal popups, price tags, or add-to-cart buttons on the home screen.
4. **Branch Persistence**: Honor `localStorage.getItem('foodies_customer_selected_branch')` so manual branch selection is never overridden by geolocation auto-detection.
5. **Fixed Header, Full-Width Category Line, Horizontal Category Auto-Scroll & Pure Sticky Checkout Card**:
   - `CustomerHeader` is permanently fixed at `position: fixed; top: 0; left: 0; right: 0; height: 72px; zIndex: 1000;`, with `paddingTop: 72px` on `<main>`, completely eliminating any header jumping, moving, or page shaking on scroll.
   - All parent containers use `overflow-x: clip` (not `hidden`), preserving native browser `position: sticky` context relative to the viewport.
   - The Category filters row spans the **full line** across the entire page width immediately below the fixed header (`position: sticky; top: 72px; width: 100%; zIndex: 900;`) with tight padding (`4px 0 6px`) so the category words are close to the header just like earlier.
   - **No "All" Tab**: The generic "All" category is removed; the bar strictly displays authentic food categories (Appetizers, Burgers, Pizza, Desi Karahi, Desserts, Beverages), defaulting to `Appetizers`.
   - **Horizontal Category Auto-Scroll**: As the customer scrolls vertically through menu items, the category options row automatically scrolls horizontally from left to right (`row.scrollTo({ left: target, behavior: 'smooth' })`) to keep the active category pill centered and visible on screen at all times instead of remaining off-screen.
   - **Zero Initial Jump Guarantee on Small Screens**: On small screens (`<= 860px` and `<= 640px`), `.foodies-menu-container` has `padding-top: 0 !important` and `.foodies-category-bar-full-line` has `margin-top: 0 !important; top: 72px !important;`. The category options start immediately at `top: 72px` flush under the header at initial load (`scrollY = 0`), so they **never jump or shift upward** when scrolling begins.
   - Below the category line, the layout hosts two columns: the left menu dishes and the right static checkout card (`position: sticky; top: 126px; height: 520px; maxHeight: calc(100vh - 146px);`). Both the category bar and checkout card remain firmly static at their positions on scroll (never scrolling past the header or disappearing). Inside the checkout card, items are scrollable within the card body (`overflowY: auto`).
   - **Bottom Scroll Stopping Rule**: Container bottom padding is set to `20px` (`cartCount > 0 ? '80px' : '20px'` on mobile). When the customer scrolls down to the last menu item, the scroll stops as soon as the bottom of the last card is cleanly displayed above the bottom of the screen. The checkout card is never pulled upward and remains firmly static at `top: 126px`.
   - ScrollSpy uses `requestAnimationFrame` and never triggers programmatic `scrollIntoView` during user scroll, ensuring 60fps scrolling without hangs or freezes.
   - When the screen becomes small (`<= 860px`), the side checkout card is removed, item cards expand to 2-columns (shrinking as screen boundaries touch them), while the category line remains static at `top: 72px`. A mobile checkout bar appears at the bottom. Clicking "Proceed to Checkout" opens the full checkout drawer/page (`CustomerCheckout`), which further proceeds to pop-up screens of login, dine-in table picker, etc.
6. **Notifications Below Header**: `ToastContainer` must appear at `top: 72px`, with its top edge in line with the bottom border line of the 72px header.
7. **Quantity 1 Delete Icon**: Decrement button must render `Trash2` delete icon when `quantity === 1` and `Minus` when `quantity > 1`.
8. **Free Tables Only for Customer**: Customer table selection shows only available tables (`status === 'available'`) with only table numbers, with zero edit tools.
9. **Equal Modal Card Fit Across All Steps & Scrollable Payment Methods**: All Stage 1, Stage 2, and Stage 3 checkout cards (Dine-In, Takeaway, Delivery, and Payment) share the identical static `maxWidth: 540px`, with `height: 'auto'` and `maxHeight: 94vh`. The card ends cleanly right below the action buttons with compact padding, completely eliminating any empty card bottom space below the buttons. If payment methods are more, the payment methods list inside is smoothly scrollable (`maxHeight: 270px; overflowY: auto; paddingRight: 4px`), while the card dimensions remain static and equal to earlier checkout cards.
10. **Print Specific Receipt Only & Authentic 80mm POS Format**: Receipts print strictly the receipt container (`#printable-order-receipt`) via isolated iframe formatted to authentic 80mm thermal receipt roll dimensions (`@page { size: 80mm auto; margin: 0; }`). The print height dynamically fits only the order content length, default browser margin metadata (URL, title, date in top-left/corners) is eliminated via `margin: 0`, the cafe logo watermark is rotated to 135° and prints reliably using an `<img>` element with `print-color-adjust: exact`, and the exact date and time (e.g., `18 Oct 2026, 05:30 AM`) is printed in place of relative time phrases ("how much time ago").
11. **Unscrollable Pop-up Screens Rule**: In all pop-up screens across the customer portal (`CustomerCheckout`, `CustomerLoginModal`, `CustomerHeader` profile modal, `ItemDetailModal`), modals must **never become scrollable** (`overflow: 'hidden'`). Element paddings, gaps, and text sizes shrink fluidly (`clamp()`) to fit within the viewport. The **only exceptions** are table selection (`CustomerFloorSeatingModal` & Dine-In table picker) and payment methods when methods exceed container capacity: the list inside scrolls while the popup card remains static.
12. **Sign In Modal Styling & Clean Wording**: The customer login modal displays the heading "Sign In" (the word "Customer" is removed for a cleaner, unified authentication interface). The primary action button "Send SMS Code" uses black text (`#000000`) with medium weight (`fontWeight: 600`) instead of heavy/bold white text.
13. **Identical Dish Order Box Sizing**:
    - The "Order" / "Add" button (`.dish-order-btn`) and the add/delete quantity stepper (`.dish-qty-stepper`) share identical outer box dimensions across all responsive breakpoints:
      - Desktop (> 860px): `82px × 32px`
      - Intermediate / Tablet (<= 860px): `80px × 30px`
      - Mobile (<= 640px): `76px × 28px`
      - Extra-small phones (<= 380px): `68px × 26px`
    - Clicking "Order" or incrementing/decrementing items never shrinks, expands, or jumps the button box.
14. **Category Row Coloring on Full Dish Card Display**:
    - ScrollSpy detects dishes via `.foodies-dish-card[data-category]`.
    - Whichever category's dish item card is at full display on screen (`rect.top >= topBoundary - 6 && rect.bottom <= bottomBoundary + 6`), its category pill in the sticky top category bar is automatically colored (`selectedCategory === cat`), and the category bar smooth-scrolls horizontally to center that active category pill.
15. **Footer Scroll Stopping & In-Line Small Screen Layout**:
    - On screens `<= 860px`, `.marketing-home-container` has `padding-bottom: 0 !important;` and `.marketing-home-footer` has `margin-bottom: 0 !important; border-radius: 0; width: 100%;`.
    - Scrolling cleanly stops the moment the bottom of the footer touches the bottom edge of the viewport, eliminating any empty buffer and completely preventing the footer from scrolling up out of the bottom of the screen.
    - Column 1 (Brand & "Quality multi-branch cafe..." tagline), Column 2 ("Quick Navigation"), and Column 4 ("Customer Support") stay strictly in line side-by-side in one horizontal row across all screen sizes down to 360px, with fluidly scaled typography (`clamp()`).
16. **Empty Cart Header Navigation (No Login Prompt First)**:
    - When not logged in, pressing the Cart option from the header while the cart is empty (`cartCount === 0`) takes the user directly to menu items (`onNavigate('menu')`) rather than opening checkout and asking for login first.
    - If the login modal was open, clicking Cart closes the login modal.
    - When the cart is opened with items, it always begins at `order_review` (the cart itself) so users can review items without being asked for login first.
17. **Checkout Login Screen Identical to Customer Login Modal**:
    - When an unauthenticated user clicks "Proceed to Checkout" from the cart, the login screen that appears matches the customer sign-in modal identically:
      - Logo watermark background (`opacity: 0.22`)
      - Foodies Cafe logo inside white rounded box with border and shadow
      - Heading: "Sign In", Subtitle: "Sign in with your name and mobile number"
      - Full Name input with `User` icon
      - Pakistani Mobile Number with `🇵🇰 +92`
      - Button: "Send SMS Code" with black text (`#000000`, `fontWeight: 600`) and `ArrowRight` icon
      - OTP Confirmation step with Demo SMS Code banner (`5829`), 4-digit code input, and "Confirm & Sign In" button with black text (`#000000`, `fontWeight: 600`) and `Check` icon.
      - Upon confirmation, user is authenticated and proceeds directly to fulfillment order options.
18. **Staff Header Clean Layout & Name Formatting**:
    - "Customer Storefront" button/link is completely removed from the staff top header.
    - Staff role/status badge (e.g. `Branch Manager`, `Kitchen Staff`, `Cashier`, `Floor Staff`) is displayed **before** the staff member's name.
    - Any bracketed role information (such as `(Manager)` or `(Branch Manager)`) is strictly stripped using `.replace(/\s*\(.*?\)/g, '').trim()`.
    - The clean staff name is positioned at the very end (far right) of the header.
19. **Kitchen Dish Availability Toggle (Mark / Remove Unavailable Status)**:
    - Kitchen staff can view all dishes in the active branch and flag any item unavailable (out of stock/ingredients missing).
    - When ingredients are restocked, staff can remove the unavailable status with a single click ("Remove Unavailable Status (Make Available)") to restore item availability across customer and POS ordering.
    - Kitchen header displays a live status indicator showing the count of currently unavailable dishes.
20. **Order Lifecycle Card Progression to Server / Waiter**:
    - Orders move cleanly between respective status columns in the Kitchen Queue: `Incoming Orders` (`placed`/`accepted`) -> `Now Preparing` (`preparing`) -> `Ready for Service` (`ready`) -> `Sent to Waiter` (`served`).
    - Marking an order "Mark to Serve (Send to Waiter)" sets status to `'served'` and routes it into the dedicated "Orders Ready for Server / Waiter" panel in `FloorTables.tsx`.
    - Waiters/Floor representatives see the table number, customer name, and item details, and click "Mark Delivered & Served to Table ✓" to complete the delivery and transition order status to `completed`.
21. **Authentic 80mm Thermal Printing with 135° Watermark**:
    - All receipts (Customer History, Cashier POS) and KOT tickets (Kitchen) print via an isolated 80mm thermal receipt iframe with `@page { size: 80mm auto; margin: 0; }` and `-webkit-print-color-adjust: exact`.
    - The official cafe logo (`/logo.png`) rotated at 135° (`transform: rotate(135deg); opacity: 0.16;`) is placed as a centered watermark in place of a plain white background.
    - Browser default URL, title, date margins in page corners are completely eliminated, and only the receipt content prints with zero UI displacement.
22. **Pristine State & Live Multi-User Synchronization**:
    - All mock dummy orders, complaints, shifts, and table locks are completely purged. Tables start in 100% available state, ready for active dine-in sessions.
    - Dual-channel real-time sync: instant `BroadcastChannel` communication across tabs alongside continuous 2.5-second polling of `/api/orders`, `/api/tables`, and `/api/menu` from PostgreSQL.
    - Any action taken in any role (customer placing order, kitchen starting prep, cashier taking cash, waiter completing table delivery) immediately propagates to and influences all other concerned users in real time without manual page refreshes.
23. **Order Box Sizing, Checkout Flow & Cancellation Rules**:
    - **Extended Order Box Length**: Increased horizontal box length (`.dish-order-btn` and `.dish-qty-stepper`) to `96px` (desktop), `92px` (intermediate <= 860px), `86px` (mobile <= 640px), and `78px` (<= 380px), ensuring the word ("Add", "Order", "Sold Out") fits comfortably with normal proportions without text wrapping or clipping.
    - **Direct Fullscreen Checkout Pop-up Flow**: Clicking "Proceed to Checkout" from the desktop static checkout card or mobile checkout bar directly opens the Login pop-up modal (`auth`) if the customer is unauthenticated, or directly opens the fulfillment order options modal (`fulfillment`) if already logged in, completely bypassing the redundant cart review modal.
    - **Fluid & Beautiful Payment Card Height Expansion**: Modal card and payment method options feature smooth, bezier-curved transitions (`transition: all 0.32s cubic-bezier(0.16, 1, 0.3, 1)`), custom sleek scrollbars, and animated installment breakdowns so any vertical length increase looks polished and premium.
    - **Fixed High-Speed Cross-Tab Ping-Pong Broadcast Loop**: Added unique `tabIdRef` and `isRemoteSyncRef` guards to `BroadcastChannel` and deep-equality checks on polling updates in `AppContext.tsx`, completely eliminating redundant re-render loops and high-speed toggles during order tracking.
    - **Order Edit Deselect All -> Order Cancelled**: In `CustomerOrderEdit.tsx`, deselecting all items displays a prominent "All Items Deselected — Order Will Be Cancelled" card with immediate "Confirm Order Cancellation" action instead of an empty items order.
    - **Stage 2 Cancellation Restriction**: Once kitchen preparation starts (`preparing`), customers cannot cancel the order directly and are courteously informed to contact the branch assistant / representative via a dedicated modal dialog and support trigger.
    - **Left Slide Header Line Alignment to Home Page Bottom Border**: The slide-out navigation drawer header is styled at `height: 72px` with `boxSizing: 'border-box'` and `borderBottom: '1px solid var(--border-color)'`, matching the home page header's bottom border line down to the exact pixel.

24. **Order Tracking, Edit Order Flow & Cross-User PostgreSQL Database Sync**:
    - **Clean Order Edit Display with Real Current Order Dishes**: When clicking "Edit Order", all ordered items from the customer's active order are reliably populated into state using an automatic synchronization effect. Walk-in cashier orders now pass dish items directly, preventing orders with empty items.
    - **Removed Unwanted Banners & Switchers**: Completely removed the Stage 1 top banner ("STAGE 1: FULL ORDER EDITING ACTIVE..."), the countdown timer text ("Full editing closes in 12:30"), all other stage warning cards, the test stage switcher ("TEST STAGE: Stage 1, Stage 2, Stage 3"), and the oversized inner cancel card.
    - **Top-Left Corner Back Arrow**: Placed the `<ArrowLeft>` back icon button on the top-left corner of the edit order card, and cleanly removed the text "Back to Tracking".
    - **Dynamic "Cancel Order" / "Update Order" Button**: When all items in the order are deselected (quantity 0) and no other item is added, the action button dynamically displays **"Cancel Order"** (with red danger styling) and cancels the order upon clicking. When items are present, the button displays **"Update Order"** and saves the revised items.
    - **Tracking Page Edit & Cancel Buttons**:
      - Edit button label strictly changed to **"Edit Order"** (clean and concise).
      - Cancel Order button is clickable, responsive, and functional.
      - Supports a manager-selected flexible cancellation/edit time window (`currentBranch.fullEditWindowMin`), without displaying any countdown timer numbers on screen (the button is simply clickable/editable during the allowed window or before kitchen preparation begins).
    - **Cross-User & Multi-Staff Database Synchronization**:
      - Updated `/api/orders` PATCH route to handle status, payment status, items, total, original subtotal, add-on subtotal, notes, and version.
      - Numeric columns (`NUMERIC(10,2)`) from PostgreSQL are normalized to JavaScript numbers upon fetch, preventing false-positive JSON equality diffs during 2.5-second polling.
      - Implemented a long-lived, persistent `BroadcastChannel` instance to eliminate dropped cross-tab messages and enable instantaneous real-time status transitions between customers, kitchen staff, cashiers, and branch managers without requiring page reloads.

25. **Branch Representative Ready Orders & Menu Price Synchronization Across All Portals**:
    - **Branch Representative Portal — 2 Dedicated Ready Order Cards (`RepresentativeInbox.tsx`)**:
      - Above the customer inquiries panel, two distinct, pure light mode operational cards manage kitchen-ready orders:
        - **Card 1: Takeaway Orders — Ready to Take (Counter Pickup)**:
          - Automatically filters orders where `o.type === 'takeaway' && o.status === 'ready'`.
          - Displays order number, customer name, clickable phone link (`tel:`), pickup notes, dishes breakdown, order total, and cash payment badge (`PAID` in green vs `COLLECT CASH: Rs. XXX` in amber).
          - Features a 1-click **"Hand Over to Customer ✓"** action button that transitions order status to `completed` and removes it from the ready queue.
        - **Card 2: Delivery Orders — Ready to Ship (Rider Dispatch & Delivery)**:
          - Automatically filters orders where `o.type === 'delivery' && (o.status === 'ready' || o.status === 'out_for_delivery')`.
          - Displays order number, customer delivery address with map pin icon, customer phone link, dishes breakdown, order total, and payment status badge (`PAID` vs `CASH ON DELIVERY`).
          - Includes two sequential action buttons: **"Dispatch with Rider →"** (transitions status from `ready` to `out_for_delivery`) and **"Mark Delivered & Completed ✓"** (transitions status to `completed`).
    - **Menu Item Price & Detail Updates Synchronization (`AppContext.tsx` & `/api/menu`)**:
      - Authorized staff or managers editing item prices or details in "Menu & Banners Manager" (`mgmt-menu`) now have their changes immediately propagated across the entire system.
      - Fixed root cause where `updateMenuItem` was only mutating local React state without saving to PostgreSQL, causing the 2.5s DB polling to immediately overwrite user changes with stale database values.
      - `AppContext.tsx` now calls `broadcastMenu` on `updateMenuItem`, `updateMenuItemPrice`, `addMenuItem`, and `deleteMenuItem`, saving changes to `localStorage` and broadcasting `SYNC_MENU` across all tabs in 0ms.
      - Asynchronous `PATCH /api/menu`, `POST /api/menu`, and `DELETE /api/menu` persist changes directly to PostgreSQL.
      - `/api/menu` GET and PATCH routes parse and normalize `basePrice` as numbers (`Number(base_price)`), preventing false-positive JSON equality mismatches in the polling loop.
      - The Manager's left slide "Menu & Banners Manager" and the Customer Menu (`CustomerMenu.tsx`) now immediately reflect updated prices and dish availability in real time without manual reloads.

26. **Direct Customer-Support 3-Category Workspace & Left Slide Takeaway / Delivery Navigation**:
    - **Left Slide Navigation Options (`StaffLayout.tsx` & `app/src/app/staff/page.tsx`)**:
      - For Branch Representatives (and Branch Managers), two dedicated 1-click navigation options are added directly into the left slide sidebar:
        - **Takeaway Orders** (`staff-rep-takeaway`): Accompanied by a live badge showing the count of orders currently packed and waiting for collection (`X Ready`). Opens the dedicated Counter Pickup Handover dashboard.
        - **Delivery Orders** (`staff-rep-delivery`): Accompanied by a live badge showing the count of orders ready to ship or out for delivery (`X Active`). Opens the dedicated Rider Dispatch & Shipping dashboard.
      - Staff router in `page.tsx` cleanly maps `staff-rep`, `staff-rep-takeaway`, and `staff-rep-delivery` to `RepresentativeScreen` with matching initial tabs.
    - **Support & Queries 3-Category Big Workspace Table (`RepresentativeInbox.tsx`)**:
      - **Category 1: Customers List (Left Column)**:
        - Aggregates all customers with inquiries (`complaints`), customers who have placed orders (`orders`), and registered users.
        - Features real-time search (by customer name, mobile number, or ticket number) and category filtering pills (`All`, `Inquiries`, `Orders`).
        - Renders customer avatars with initials, online indicators, mobile numbers, inquiry status badges (`NEW`, `IN PROGRESS`, `RESOLVED`), and order count tags.
        - Clicking any customer selects them and immediately focuses Category 2 and Category 3.
      - **Category 2: Direct 1-on-1 Live Chat (Center Column)**:
        - Displays the live conversational message thread between the selected customer and the representative.
        - Shows distinct customer bubbles vs representative branded bubbles with sender tags and timestamps.
        - Includes quick canned response chips ("Your order is ready at the counter!", "Rider has picked up and is en route", "Checking with kitchen now...", "Added Rs. 250 courtesy credit").
        - Message composer enables immediate replies that broadcast to the customer storefront in 0ms and persist to PostgreSQL.
        - Quick action header buttons for direct phone dialing (`tel:`), ticket escalation to the branch manager, and 1-click resolution.
      - **Category 3: Direct Customer Order History (Right Column)**:
        - Automatically and directly fetches the complete order history of the selected customer using their phone number, ID, and customer name.
        - Displays a Customer Profile Card with total orders, total lifetime spend, and active order counts.
        - **Live Active Orders Section**: Prominently highlights in-progress orders (`placed`, `preparing`, `ready`, `out_for_delivery`) with animated live indicators, dish breakdowns, total amounts, and quick actions ("Hand Over ✓" for takeaway, "Dispatch Rider →" for delivery).
        - **Complete Historical Order Timeline**: Renders all past completed or cancelled orders with order numbers (`#FC-XXXX`), fulfillment types, dish items breakdown, and a 1-click recovery refund button (`requestRefund`).
    - **PostgreSQL Database & Cross-Portal Real-Time Synchronization (`/api/complaints` & `AppContext.tsx`)**:
      - Implemented RESTful API route `/api/complaints` (`GET`, `POST`, `PATCH`) with JSONB message history support.
      - Seeded authentic initial customer inquiries for `Zeeshan Ahmed` and `Ali Raza`.
      - Added instant cross-tab communication (`SYNC_COMPLAINTS`) via `BroadcastChannel`, `localStorage` backup, and 2.5s DB polling in `AppContext.tsx` so customer queries and representative replies sync instantaneously across all windows.

27. **Universal Live Chat, Scrollable Orders & Full Marketing/Categories PostgreSQL Sync**:
    - **Live Chat Auto-Scroll & 0ms Cross-Tab Synchronization (`CustomerSupport.tsx` & `RepresentativeInbox.tsx`)**:
      - Both the customer support screen and branch representative inbox now feature automated scroll-to-bottom on message arrival via `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })`.
      - Robust fallback and instant thread initiation ensure that even unauthenticated or first-time customers can message the representative without encountering blank screens.
      - Dual-channel sync (`BroadcastChannel` with `SYNC_COMPLAINTS` alongside PostgreSQL `/api/complaints`) guarantees instant 0ms message delivery between customer and staff tabs.
    - **Dedicated Scrollable Order Lists in Customer & Support Portals**:
      - **Customer Support Portal (`CustomerSupport.tsx`)**: Includes a dedicated, scrollable order reference panel (`maxHeight: '250px'`, `overflowY: 'auto'`) displaying order numbers, statuses, items, and total prices with a 1-click **"Inquire About This Order →"** button that pre-fills and links the inquiry ticket.
      - **Representative Portal Category 3 (`RepresentativeInbox.tsx`)**: The "All Order Records" panel is encapsulated within a dedicated scrollable container (`maxHeight: '340px'`, `overflowY: 'auto'`) with a "Scrollable List" badge. This keeps the customer summary card and live active orders pinned at the top while staff scroll through extensive past order records.
    - **Full Database Sync for Categories, Banners, Deals & Footer (`/api/marketing` & `AppContext.tsx`)**:
      - Created `/api/marketing` (`GET`, `PATCH`) interfacing directly with PostgreSQL tables `hero_banners`, `deal_cards`, `footer_settings`, and `categories`.
      - **Category Management**: Adding, renaming, and deleting categories now persists directly to the database. Renaming cascades to update all corresponding `menu_items.category` rows in PostgreSQL.
      - **Hero Banners**: Adding, editing, and deleting banner slides synchronizes to PostgreSQL `hero_banners` and updates the customer carousel in real time.
      - **Chef's Special Deal Card**: Updating the deal card immediately saves to `deal_cards` and updates the 3D interactive showcase on the customer home screen.
      - **Footer Settings**: Editing cafe helpline, email, hours, branch addresses (Lahore, Islamabad, Karachi), and tagline persists to `footer_settings` and updates the customer footer sitewide.
      - Dual-channel broadcast (`SYNC_MARKETING` on `BroadcastChannel`, `localStorage` backup hydration, and 2.5s DB polling) ensures all marketing and category changes are reflected universally across all tabs and devices without requiring page refreshes.

28. **Dine-In Navigation, Complete Order Status Lifecycle & Instant Order Inquiry Search**:
    - **Side Navigation & Workspace Options (`StaffLayout.tsx` & `app/src/app/staff/page.tsx`)**:
      - Added a dedicated **Dine-In Orders** (`staff-rep-dinein`) navigation item with the `Utensils` icon alongside Takeaway and Delivery for Branch Representatives and Managers.
      - Dynamic, live branch badges compute active and ready order counts in real time:
        - Dine-In: `${activeDineInCount} Active`
        - Takeaway: `${readyTakeawayCount} Ready` or `${activeTakeawayCount} Active`
        - Delivery: `${readyDeliveryCount} Out/Ready` or `${activeDeliveryCount} Active`
      - Any order placed by a customer for that branch immediately increments the corresponding badge in the side navigation without page refreshes.
    - **Comprehensive Order Lifecycle Status Flow (`RepresentativeInbox.tsx`)**:
      - **Takeaway Orders Hub (`activeTab === 'takeaway'`)**:
        - **Order Arrived** (`placed` / `accepted`): Placed orders immediately appear with an amber **"ORDER ARRIVED"** badge and customer contact details. Staff can click **"Accept & Send to Kitchen →"** to advance the order into kitchen preparation.
        - **Cooking in Kitchen** (`preparing`): Displays a blue **"COOKING IN KITCHEN"** badge with a **"Mark Kitchen Ready ✓"** override action.
        - **Ready to Take** (`ready`): Once kitchen marks food ready, orders transition to **"READY TO TAKE"** (green badge). Staff can click **"Hand Over to Customer ✓"** to complete the pickup.
        - Status filter pills (`All`, `Order Arrived`, `In Kitchen`, `Ready to Take`, `Completed`) and a real-time search input allow instant filtering.
      - **Delivery Orders Hub (`activeTab === 'delivery'`)**:
        - Displays complete doorstep progression: **Order Arrived** (with full delivery destination address and "Accept & Send to Kitchen →") -> **Cooking in Kitchen** -> **Ready to Ship** (with "Dispatch with Rider →") -> **Out for Delivery** (with "Mark Delivered & Completed ✓") -> **Completed**.
      - **Dine-In Orders Hub (`activeTab === 'dine_in'`)**:
        - Displays table orders at the branch: **Order Arrived (Table Seated)** (with Table # and "Send to Kitchen →") -> **Cooking in Kitchen** -> **Ready for Service / Served** (with "Mark Table Completed ✓") -> **Completed**.
    - **Instant Order Search & Inquiry Lookup Bar (`RepresentativeInbox.tsx`)**:
      - Positioned universally at the top of the Representative screen across all tabs.
      - Enables staff to search by Order Number (e.g. `6744` or `#FC-6744`), customer name, phone number, or table number.
      - Instantly displays an **Order Inquiry Confirmation Card** detailing the order's live status ("Order Arrived", "Cooking in Kitchen", "Ready to Take", "Rider On The Way", etc.), branch location, customer info, dishes list, and payment status.
      - Includes a 1-click **"Confirm & Open Chat"** action that automatically switches to the Support tab, selects that customer in Category 1, and displays their live order history in Category 3.
      - Enhanced Category 1 Customer search in Support & Queries to match customers by their active or historical order numbers as well.

## 5. Branch Manager Access Control, Oversight & PostgreSQL Architecture

1. **Sidebar Navigation & First 2 Options Edit Restriction**:
   - The Branch Manager role is strictly restricted so that **changes can only be made in the first 2 left sidebar options**:
     - **Option 1 (`staff-manager`)**: Branch Manager Overview & Analytics (`canEdit: true`).
     - **Option 2 (`mgmt-menu`)**: Menu, Categories, Hero Banners, Deals & Footer Settings (`canEdit: true`).
   - For all subsequent options (`staff-pos`, `staff-cashier`, `staff-kitchen`, `staff-tables`, `staff-rep`, `staff-audit`), `canEdit: false` is enforced. These screens render in **dedicated observation, oversight, and approval mode**, with operational action buttons disabled or hidden.

2. **Action-Required Pop-Up Indicators on Sidebar**:
   - For any sidebar option requiring manager attention, approval, or escalation, a pulsing amber indicator (`⚠️ ACTION REQ (X)`) appears directly on that navigation button, complete with CSS keyframe pulsing animations (`@keyframes pulseActionReq`) and collapsed alert dots:
     - **Cashier Desk (`staff-cashier`)**: Triggered when `pendingRefundCount > 0`.
     - **Support & Queries (`staff-rep`)**: Triggered when `pendingComplaintCount > 0` (unresolved escalations).
     - **Menu & Categories (`mgmt-menu`)**: Triggered when `pendingBannerApprovalCount > 0`.

3. **Kitchen Live Status KPIs (`KitchenQueue.tsx`)**:
   - When accessed by the Branch Manager, the kitchen monitor switches to an executive dashboard displaying 4 live KPI status cards:
     - **Orders Came Today**: Total orders received at branch today.
     - **Orders Accepted**: Orders confirmed and entered into kitchen.
     - **Orders Prepared**: Successfully prepared dishes ready for service.
     - **Currently Cooking**: Orders actively on the grill/stove.
   - Cooking action buttons ("Accept", "Start Cooking", "Mark Ready") and ingredient stock toggles are hidden, rendering clean read-only status badges.

4. **Cash Desk Monitor & Financial Oversight (`CashierDesk.tsx`)**:
   - Till drawer operations, walk-in counter order creation, and shift opening/closing are reserved for cashiers.
   - The Branch Manager is provided with the **Manager Cash Desk Monitor** featuring 3 comprehensive tabs:
     - **Financial Calculation Reports**: Time filters (`Today`, `Yesterday`, `Last 7 Days`, `All Time`, `Custom Date Range`), channel filters (`All`, `Dine-In`, `Takeaway`, `Delivery`), and 8 financial calculation cards (Total Revenue, Cash in Tills, Digital/Cards/Raast, Refunds Issued, Net Collections, Dine-In Total, Takeaway Total, Delivery Total) plus channel distribution analysis.
     - **Per-Shift & Per-Cashier Audit History**: Full audit table showing every recorded shift, cashier name, opening float, cash collected, expected cash, counted actual cash, discrepancy/variance (+/- in green or red), status, and notes.
     - **Multi-Channel Full Order History**: Order search filter, channel pills, and master-detail inspector showing customer info, dishes, portions, extras, financial breakdowns, and official 80mm thermal receipt printing with 135° watermark.
     - **Refund Authorizations**: Pending refund requests banner card with manager **"Approve Refund ✓"** and **"Reject Refund ✗"** actions. Approvals immediately update PostgreSQL and change order payment status to `'refunded'`.

5. **Floor Tables, Seating History & Waiter Metrics (`FloorTables.tsx`)**:
   - Interactive table status buttons ("Mark Seated", "Mark Cleaning", "Mark Free") and waiter food delivery dispatches are disabled for the manager.
   - Manager oversight monitor provides:
     - **Tables Occupied Today**: Total distinct seating sessions today and current occupancy percentage.
     - **Average Seating Duration**: Average table turnaround time in minutes.
     - **Table Occupancy Sessions Log**: Historical log of every table occupied with Table #, Floor, Guest Name, Start Date & Time (Seated At), End Date & Time (Departed At), Duration in minutes, Assigned Waiter, Order #, Total Bill, and Status (`Occupied Now` vs `Completed`).
     - **Waiter Performance Cards**: Breakdown for each waiter showing **Total Orders Served Today**, Active Tables currently under service, and Total Dine-in Sales billed.

6. **Support & Inquiries Desk (`RepresentativeInbox.tsx`)**:
   - Branch Manager can search orders, inspect customer profiles, and review inquiry conversations.
   - **Query Answering is Disabled**: The chat composer and canned quick-reply buttons are hidden and replaced with:  
     *"Manager Oversight Mode: Query Answering Disabled. Customer inquiries are answered directly by Support Representatives. Managers review escalations and authorize refund actions."*
   - Escalation approval action buttons ("Approve & Resolve Escalation ✓") are provided where manager intervention is required.

7. **PostgreSQL Real-Time Synchronization**:
   - Local PostgreSQL database (`foodiescafe`) connected via connection pool (`app/src/lib/db.ts`).
   - Tables seeded and synced: `branches`, `categories`, `menu_items`, `menu_item_branches`, `orders`, `order_items`, `tables`, `table_sessions`, `cash_shifts`, `refund_requests`, `complaints`, `complaint_messages`, `users`, `audit_logs`.
   - REST API endpoints for `/api/shifts`, `/api/refunds`, `/api/tables/sessions` synchronized in real time via BroadcastChannel and 2.5s DB polling across Manager, Staff, and Customers.

---

## 6. Customer Order Routing & Kitchen Dispatch Architecture (`Customer Services`)

### A. Core Workflow & Architectural Mechanics
1. **Direct Routing to Customer Services First**:
   - When an order arrives from a customer (via Dine-in seating, Takeaway counter, or Delivery storefront), it is **routed directly to Customer Services** (`RepresentativeInbox.tsx`) instead of being immediately displayed to kitchen line cooks.
   - Orders remain in `status = 'placed'` with `sentToKitchen: false` until either:
     - A Customer Services agent clicks **"Ready to Go to Kitchen →"**, or
     - The configured auto-forward timer elapses, or
     - Support routing is disabled in settings (`orderRoutingSupportFirst: false`).
2. **Kitchen Queue Isolation**:
   - In `KitchenQueue.tsx`, `incomingOrders` strictly filters out orders whose `sentToKitchen` flag is `false` and whose auto-forward deadline has not passed.
   - Kitchen line cooks see an informational notification when orders are undergoing support review:  
     `"🕒 X order(s) under review at Customer Services Desk"`.
   - Once dispatched, tickets prominently feature a green verified badge: `✓ Customer Services`.
3. **Manual vs. Timed Kitchen Dispatch**:
   - **"Ready to Go to Kitchen →" Button**: Immediately sets `sentToKitchen: true`, sets `sentToKitchenAt: ISO`, changes status to `'accepted'`, updates PostgreSQL via `/api/orders`, broadcasts across tabs via `BroadcastChannel`, and displays a toast.
   - **"Set Custom Time" Modal & Live Countdown**: Allows Customer Services representatives to adjust the forwarding countdown on a per-order basis (presets: `1m`, `2m`, `3m`, `5m`, `10m`, `15m`, or custom input).
   - **Background 1-Second Ticker**: An active timer effect in `AppContext.tsx` continuously evaluates orders with `forwardToKitchenAt`. The moment `Date.now() >= new Date(forwardToKitchenAt).getTime()`, the order automatically advances to `sentToKitchen: true` and `status: 'accepted'`, syncing instantly across DB and terminals.

### B. Settings in Customer Services (`MenuAndPrices.tsx`)
- Located in **Customer Services & Menu Manager** -> **Customer Services** tab (formerly *Customer Footer Manager*).
- **Master Toggle**: `Route Customer Orders Directly to Customer Services First` (Enabled by default).
- **Forwarding Mode Selection**:
  - `Auto-Forward to Kitchen after Timer`: Support has a set window to review or alter; if untouched, the system automatically routes to the kitchen line cooks.
  - `Manual Verification Required`: Order remains held at Customer Services until explicitly released.
- **Duration Presets**: `1m`, `2m`, `3m`, `5m`, `10m`, `15m`, and custom integer input. Saved to PostgreSQL `footer_settings` table and synchronized across all sessions.

### C. Menu, Deals & Banners UI Streamlining
- **Header Cleanup**: Removed the top 2 lines (`Menu, Categories & Footer Management` and description) from the manager view for a clean, modern interface.
- **Button Alignment**: Moved `+ Create New Menu Item` into the top tabs bar, horizontally aligned in line with the Customer Services button on the right.
- **Deals Tab Renaming**: Renamed `Hero Banners & Deals (X)` tab button to simply **`Deals`**.
- **Customer Services Tab Renaming**: Renamed `Customer Footer Manager` to **`Customer Services`** with `<Headphones size={16} />` icon.
- **Card Removals from Deals**:
  - Removed Card 1: `Customer Home Banners & Chef Deal Showcase` (`Control the auto-sliding row of hero banners...`).
  - Removed Card 2: `Representative Publishing Permission & Manager Approval Workflow` (`Manager Approval Required...`, `🛡️ Approval Mode Active...`).

### D. System-Wide Terminology Alignment & Workspace Streamlining
- Renamed `Support & Queries` across sidebar navigation (`StaffLayout.tsx`), headers, and role selectors (`StaffAuth.tsx`) to **`Customer Services`**.
- Renamed manager sidebar entry to **`Customer Services & Menu Manager`** / **`Menu, Categories & Customer Services`**.
- **Customer Services Workspace Header Cleanup (`RepresentativeInbox.tsx`)**: Removed the duplicate top header block (`Customer Services Desk`, `Gulberg Branch`, description) and redundant 4-tab button strip (`Customer Services`, `Takeaway Orders`, `Delivery Orders`, `Dine-In Orders`). Since users switch views directly via the primary left slide navigation drawer, eliminating this duplicate top bar saves vertical screen real-estate and ensures clean, immediate workspace access.
- Updated `CustomerTracking.tsx` notification banner during initial placement:  
  *"Order Received · Customer Services Verification — Customer Services is verifying your order details before queueing it to the kitchen."*

### E. Order Cancellation Prior to Kitchen Dispatch & Clean Navigation
1. **Consolidated Left Slide Navigation (Dine-In, Takeaway & Delivery)**:
   - All incoming unforwarded orders (`placed` with `!sentToKitchen`) are housed directly within their authentic operational categories:
     - **Dine-In Orders** (`staff-rep-dinein`)
     - **Takeaway Orders** (`staff-rep-takeaway`)
     - **Delivery Orders** (`staff-rep-delivery`)
     - **Customer Services Desk** (`staff-rep`) (Live Active Orders in Card 3)
   - Every view contains the full set of review controls: Manual Hold / live countdown timer, **"Set Time ⏱️"**, **"Ready to Kitchen →"**, and **"Cancel Order ✕"**.
   - The redundant separate "Incoming Orders" sidebar item was completely removed from the left slide navigation drawer, streamlining staff workflow into distinct fulfillment channels.
2. **Cancellation Logic Prior to Kitchen Dispatch (`AppContext.tsx` & `RepresentativeInbox.tsx`)**:
   - If an order is cancelled prior to kitchen dispatch (`!sentToKitchen`), `cancelOrder` sets `status: 'cancelled'`, resets `forwardToKitchenAt: undefined`, and halts any background forwarding timers.
   - The order is immediately removed from `ordersAwaitingKitchen`, clearing it from the Customer Services support table and incoming queue with zero page reloads.
   - A dedicated **Cancel Order Confirmation Modal** (`cancelModalOrder`) allows support staff to choose or type a reason before confirming cancellation.

### F. Support Staff Action Boundaries, Chat Enhancements & Hair-Thin Layout
1. **Support Staff Role Boundaries on Orders**:
   - Customer support staff can only view categorized orders (Incoming, Dine-In, Takeaway, Delivery).
   - Allowable actions are strictly restricted to:
     - **Cancel Order**: Open cancellation confirmation dialog with prompt reason selection.
     - **Forward to Kitchen**: Send order immediately (`Ready to Kitchen →`) or schedule dispatch (`Set Time ⏱️`).
     - **Forward to Delivery Guy / Customer Handover**: For delivery orders, click **Dispatch with Rider →**; for takeaway, click **Hand Over to Customer ✓**.
   - Chef-specific cooking actions (**"Start Kitchen Cooking"** and **"Mark Kitchen Ready"**) are completely prohibited and removed from the Customer Services workspace.
2. **Chat Sender List Ordering (Latest Message First)**:
   - In Category 1 (Customers List), each customer calculates `latestTimestampMs` from recent messages, ticket creation, or order activity.
   - The customer sender list dynamically sorts by `b.latestTimestampMs - a.latestTimestampMs` descending, ensuring whoever sent the newest incoming message appears first at the top.
3. **Chat Message Timestamp (Bottom Right Corner)**:
   - Every message bubble in the live chat thread features its formatted 12-hour timestamp (e.g. `12:45 PM`) positioned cleanly in the bottom right corner of the message box (`position: 'absolute'; bottom: '3px'; right: '8px'`).
4. **Chat Day/Date Dividers**:
   - Messages are grouped by calendar day. Before each day's first message, a divider badge is rendered:
     - **< 7 Days Ago**: Shows the **Day Name** (e.g., "Today", "Yesterday", "Monday", "Tuesday", etc.).
     - **>= 7 Days**: Shows the **Date** (e.g., "12 Oct 2026").
5. **Complete Removal of Universal Search Row & Hair-Thin ("Single Hair") 3-Card Layout**:
   - The redundant top search line (*"Search by Order #, Customer Name, Phone, or Table to confirm inquiry... Branch: Gulberg Branch (Flagship)..."*) has been **completely removed** from Customer Services.
   - Removing this row eliminates visual clutter and allows the 3-category customer services workspace to occupy the full available screen height directly below the staff header.
   - The 3 cards container is permanently static (`display: 'grid'; gridTemplateColumns: '320px 1fr 380px'; gap: '1px'`), creating an ultra-refined, single-hair thickness separation line over the border background.
   - **Card 3 Scrolling Behavior**: Card 3 itself is static with a pinned top header and customer stats (`flexShrink: 0`), while the data tables and order lists inside (`flex: 1; overflow-y: auto`) are smoothly scrollable.
6. **Left Slide Navigation Reordering (Customer Services Moved to Second-to-Last Option)**:
   - In the Customer Services (`branch_representative`) left slide sidebar, the first option (*"Customer Services"*) has been moved to the **second-to-last option**.
   - The updated navigation sequence is:
     1. **Dine-In Orders** (`staff-rep-dinein`)
     2. **Takeaway Orders** (`staff-rep-takeaway`)
     3. **Delivery Orders** (`staff-rep-delivery`)
     4. **Customer Services** (`staff-rep`) — *Repositioned as second last option with live pending complaint badges*
     5. **Customer Services & Menu Manager** (`mgmt-menu`) — *Last option*
7. **Incoming Complaint Sender List Prioritization & Visual Distinction**:
   - **Top Priority in Sender List**: When a complaint is filed or a customer sends an unanswered message (`hasNewComplaint`), that customer automatically jumps to the **very top** of Category 1 (Customers List), sorted above non-complaint contacts.
   - **Distinct Name Color**: That person's name appears with a prominent alert crimson color (`#DC2626`, `fontWeight: 900`), immediately distinguishing them from standard customer contacts.
   - **New Message Count & Unread Signs**:
     - **Count Badge**: A prominent `● {count} New` badge is displayed next to their interaction time.
     - **Avatar Unread Indicator**: A pulsing notification badge dot is rendered on the top right of the customer avatar.
     - **Card Left Border & Wash**: The card features an alert left border (`4px solid #DC2626`) and soft alert background wash (`#FEF2F2`).
     - **Ticket Status Badge**: Shows an alert pill `[!] #{ticketNumber} · NEW COMPLAINT` in `#DC2626`.
     - **Category 1 Urgent Counter**: Header displays `● {urgentCount} Urgent` and the *Inquiries* filter pill displays the count of unread incoming complaints.

8. **Customer Services Layout Lock, WhatsApp-Style Chat Scroll & Uniform Order Cards**:
   - **Static Header Lock & Zero Page Scroll**:
     - The top of the Customer Services card container is locked directly below the staff header (`calc(100vh - 60px)` with `overflowY: 'hidden'` on `<main>`).
     - **Bug Resolved**: Previously, when message histories grew longer than screen height, the entire card slid upward under the sticky header and pushed the input up. The layout now isolates all vertical scrolling strictly inside internal component containers so the card outer bounds remain 100% static.
   - **Card 1 (Senders / Members List)**:
     - Search bar and category filter pills are pinned statically at top (`flexShrink: 0`).
     - Only the member names and customer cards scroll smoothly inside (`flex: 1; overflow-y: auto`).
   - **Card 2 (WhatsApp-Style Complaint Live Chat)**:
     - Profile chat header is pinned at the top (`flexShrink: 0`).
     - Chat messages feed scrolls internally (`flex: 1; overflow-y: auto; minHeight: 0`) just like WhatsApp and the customer web complaint chat.
     - Reply input box and quick canned response chips stay pinned statically at the bottom (`flexShrink: 0`) in line with the card bottom.
   - **Card 3 (Uniform Order History & Ordered Menu Pop-up Modal)**:
     - Header and quick spend stats are pinned at the top (`flexShrink: 0`) with quick tabs (`All`, `Active`, `Past`).
     - Only the orders list scrolls inside (`flex: 1; overflow-y: auto`).
     - **Uniform Order Cards**: Every single order card is rendered with the exact same height (`76px`), width (`100%`), and 2-row layout (Row 1: Order #, Status pill, Timestamp; Row 2: Channel, item count, total price, and `Menu ↗` button).
     - **Ordered Menu Pop-up Modal**: Clicking any order card opens an interactive popup modal displaying:
       - Header: Order #, Status pill, and Close (`✕`) button.
       - Fulfillment context: Channel, table / delivery address / pickup, payment status.
       - Detailed "What the Customer Ordered" table: quantities (e.g. `2x`), item names, sizes, extras, special cooking instructions/notes, unit prices, and line totals.
       - Complete bill summary: original subtotal, add-on subtotal, taxes, and grand total.
       - Support representative actions directly in modal: Cancel Order, Send to Kitchen Now, and Close.

### G. Static Card Layouts, Internal Scroll Isolation & Customer Chat Enhancements
1. **Support Staff Customer Services Workspace Lock (`StaffLayout.tsx`, `app/src/app/staff/page.tsx`, `RepresentativeInbox.tsx`)**:
   - **Zero Outer Scroll / Header Lock**: When opening "Customer Services" (`staff-rep`) from the left slide sidebar, viewport height is strictly constrained (`height: '100vh', maxHeight: '100vh', overflow: 'hidden'`). The 3-card container is static and placed directly below the 60px header (`height: 'calc(100vh - 60px)'`, `padding: '8px 14px 10px'`).
   - **Card 1 (Customers List)**: Outer card does not scroll; only the customer list / table scrolls internally (`flex: 1; minHeight: 0; overflow-y: auto; overscroll-behavior: contain`). The header, search input, and filter pills remain statically pinned at top.
   - **Card 2 (Direct 1-on-1 Chat)**: Outer card does not scroll; messages feed scrolls internally (`flex: 1; minHeight: 0; overflow-y: auto; overscroll-behavior: contain`) with `minHeight: 0` ensuring zero flex container expansion. The reply composer and canned response chips are permanently pinned at the bottom (`flexShrink: 0; marginTop: 'auto'`).
   - **Card 3 (Order History & Menu Removal)**: Outer card does not scroll; customer order records scroll internally (`flex: 1; minHeight: 0; overflow-y: auto; overscroll-behavior: contain`).
   - **Removal of Word 'Menu' in Order Cards**: Removed the word `"Menu"` from the order card action badge (previously `"Menu ↗"`), replacing it with a clean interactive icon button (`<ExternalLink size={12} />`) while preserving full clickability to open the ordered items modal.

2. **Customer Web Support Live Chat & Layout Lock (`CustomerSupport.tsx` & `app/src/app/page.tsx`)**:
   - **Zero Outer Scroll / Header Lock**: When opening "Customer Support" (`currentView === 'support'`), viewport height is locked to `100vh` (`overflow: 'hidden'`) with `<main>` set to `calc(100vh - 72px)` directly below the header. Neither the page nor the main container moves or scrolls.
   - **Text & Badge Removals**: Completely removed the `"Live Representative Online"` badge and the subtitle `"Direct private conversation with your Gulberg Branch (Flagship) representative"`.
   - **Card 1 (Your Orders) & Card 2 (Open Inquiry Threads)**: Pinned statically in a clean 360px left column. The outer cards do not scroll or move; only the orders list and the inquiry threads list scroll internally inside their respective cards (`flex: 1; minHeight: 0; overflow-y: auto; overscroll-behavior: contain`).
   - **New Ticket Modal Overlay**: Submitting an inquiry opens a floating backdrop modal that never displaces or scrolls the static page layout.
   - **Chat Date & Time Format**:
     - Message bubbles carry **ONLY the time** (e.g. `12:45 PM`), with no date inside the bubble.
     - The **date divider label** (e.g. `Today`, `Yesterday`, or `19 Oct 2026`) is written centered above the first message of each day.
   - **Removal of Sender Names Above Messages**: Removed the sender names shown above each message bubble across both Customer Web and Staff Customer Services chat.
   - **Resolution Divider & Continuous Chat Stream**:
     - When a complaint is solved (`status === 'resolved'` or `status === 'closed'`), a distinct resolution badge (`✓ Matter has been resolved`) is displayed after the last message of that inquiry.
     - When the customer submits another complaint or sends a follow-up message about any issue, the chat seamlessly continues **below that resolved message** in one unified chronological conversation thread.
   - **Read State & Unresolved Indicator Lifecycle**:
     - **Avatar Pop-up Dot Indicator**: The pop-up icon on the customer's profile pic avatar serves as the sole visual status indicator for unresolved issues (amber dot when in-progress/unresolved, red dot when unread messages are waiting, and completely removed/cleared when resolved).
     - **Clean Customer Name & Ticket Number**: Removed redundant words `resolved` and `unresolved` (and status text `· RESOLVED` or `· IN_PROGRESS`) from beside the customer name and ticket badge.
     - **Unread Message Badges**: Unread messages display as they did earlier with colored badges and count (`● {count} New` for Staff, `● New Reply` for Customer).
     - **Date Divider ("Today" Tag) Placement**:
       - Centered strictly **above** the inquiry line (e.g., `Inquiry #TKT-2556 · Inquiry on Order #FC-8225`), introducing the day's first message or inquiry.
       - Only shows once per day; subsequent messages on the same day do not carry duplicate `Today` tags.
     - **Direct Scroll to Unseen Message**: Opening a chat with unread messages automatically scrolls straight to the first unseen message, highlighted by an unread divider line (`● Unread Message Below` / `● New Message from Support Below`).

    - **Static Main Cards for Staff Navigation Options (Options 1–3, 4, and 5)**:
      - **Dine-In, Takeaway, and Delivery (Options 1–3)**: The main cards for all 3 order lifecycle options are static, positioned directly beneath the header (`height: calc(100vh - 60px)`, `overflow: hidden`), completely eliminating full-page scrolling.
      - **Internal Scroll Container**: Only the order boxes container scrolls internally within a responsive grid layout.
      - **Fixed Dimension Order Boxes**: All order boxes in Dine-In, Takeaway, and Delivery have fixed dimensions (`width: 340px`, `minWidth: 340px`, `maxWidth: 340px`, `minHeight: 175px`, `maxHeight: 205px`).
      - **Click-to-View Order Detail Modal**: Removed inline item text (e.g. `2x Biryani, 1x Coke`) from the order cards. Instead, clicking any order card opens an **Order Detail Pop-Up Screen** displaying:
        - Customer details with clickable phone call link (`tel:`)
        - Delivery address (for delivery orders) or table number (for dine-in)
        - Itemized order breakdown table (Item name, size, extras, notes, quantity, unit price, total)
        - Pricing summary (Subtotal, add-ons, tax, discount, grand total)
        - Special instructions and quick actions (Mark Kitchen Ready, Set Timer, Close)
      - **Awaiting Kitchen Actions (No "Auto Forward" Text)**:
        - When an order is received from a customer, it strictly displays **Cancel**, **Mark Kitchen Ready**, and **Set Timer** (or the remaining countdown time with **no extra text** e.g. `⏱️ 02:45`).
        - Completely removed all "Auto forward in..." and "Manual kitchen release" labels.
      - **2-Option Timer Modal**:
        - Clicking `Set Timer` opens a pop-up screen featuring two selectable scope radio cards:
          1. **"This Order"**: Sets kitchen forward timer specifically for the selected order.
          2. **"Whole Orders"**: Sets the timer across all currently awaiting kitchen orders and updates default auto-forward dispatch time for future incoming orders.
        - Provides 1m, 2m, 3m, 5m, 10m, 15m preset buttons plus a custom minute input.
      - **Sidebar Navigation Renaming & Clean Counts**:
        - **Options 1–3 Badges**: Removed the words "Active" and "Ready" from sidebar order counts; only the numeric count is shown (e.g., `2` instead of `2 Active`).
        - **Option 4 Renamed**: Renamed from "Customer Services" to **"Customer Support"**. Removed "Action Req" and "Inquiry" text badges; displays only a pop-up status dot when pending unresolved complaints exist.
        - **Option 5 Renamed**: Renamed from "Customer Services & Menu Manager" to **"Menu"**.
      - **Option 5 (Menu) Static Layout**:
        - Positioned static just below the header and categories/tabs bar.
        - Includes interactive category filter pills (`All Items`, `Biryani & Rice`, etc.) fixed at the top.
        - The menu items table scrolls internally beneath the category bar with sticky `<thead>` column headers.

---

---

## 7. Cashier Counter & Walk-in Ordering Architecture

### 7.1 Static Header & Shift Status Quick Panel (Sidebar Option 1)
- **Component**: [CashierDesk.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/CashierDesk.tsx)
- **Static Header Section**: Placed directly below the global 60px header with zero outside page scroll:
  - Strictly titled **Cashier Desk** (the words `" & Shifts"` and the subtitle paragraph `"Cash-Only Payments · Till Drawer Reconciliation · Daily Shifts"` are completely removed).
  - Action buttons: `+ Walk-in Order` and `Close Shift (Reconcile Cash)` / `Open Cash Shift`.
  - Shift summary lines formatted with compact spacing (`gap: 12px`, padding `10px 18px`):
    - `Shift Status: 🟢 ACTIVE SHIFT OPEN` (or `🔴 SHIFT CLOSED`)
    - `Opening Float (Cash In Till): Rs. 5,000`
    - `Cash Collected Today: Rs. 34,200` (live updating with database persistence)
    - `Expected Till Total: Rs. 39,200` (live updating with database persistence)
- **Internal Card Scrolling**: Everything below the shift panel (the Orders Desk list and payment settlement calculator workstation) is encapsulated in an internal scroll container (`flex: 1, minHeight: 0, overflowY: 'auto'`), ensuring the top summary lines never scroll away.
- **Scoped Visibility**: The cashier strictly sees orders placed by them for customers (walk-in counter orders), completely hiding arbitrary customer-web orders.

### 7.2 Billing Underpayment Protection
- **Vulnerability Addressed**: If a customer tendered less money than `order.total`, the payment calculator previously allowed the cashier to proceed and record payment.
- **Enforced Safeguard**:
  - `const isUnderpaid = tenderedAmount < selectedOrder.total;`
  - When underpaid, a red shortage alert is displayed: `Shortage / Underpayment: - Rs. {shortage}` and `Customer must pay the full price. Short by Rs. {shortage}`.
  - The `Record Cash Payment` button is completely **disabled**, unclickable (`pointerEvents: 'none'`, `cursor: 'not-allowed'`, opacity `0.6`, neutral gray background).
  - Backend guard in `handleRecordPayment`: Rejects any payment where `tendered < order.total` and dispatches an error toast.
  - Once the customer tenders the full price or more, the button immediately activates in green (`#16A34A`), displays change due, and allows proceeding with recording.

### 7.3 Interactive Walk-in Customer Menu & Direct Kitchen Dispatch
- **Customer Menu Modal Overlay**: Clicking `+ Walk-in Order` opens the customer-web interactive menu:
  - Live dish search input.
  - Sticky category tabs (`All`, `Biryani & Rice`, `Karahi & Handi`, `BBQ & Kebabs`, `Burgers & Fast Food`, `Breads & Sides`, `Beverages & Desserts`).
  - Dish cards displaying high-res photos, category tags, dish titles, descriptions, and branch prices.
  - Interactive "+ Add to Order" button with active stepper (`- qty +`) for selected items.
  - Floating bottom summary bar displaying cart item count and total bill with `Proceed to Order Type & Dispatch ➔`.
- **Order Type & Seating Selection Step**:
  - Prompts for delivery/order type: `Dine-In`, `Takeaway`, or `Delivery`.
  - **Dine-In**: Dynamic dropdown listing all tables where `status === 'available'` for the current branch, showing table numbers and capacities.
  - **Takeaway**: Customer name and pickup timing.
  - **Delivery**: Delivery address and phone number.
  - **Mode of Payment**: Choice between `Pay Cash Now (Paid)` or `Pay After Meal / At Till (Unpaid)`.
- **Direct Kitchen Dispatch**:
  - The walk-in order is dispatched directly to the kitchen queue via `sendOrderToKitchen(placed.id)`.
  - Sets `sentToKitchen: true`, `sentToKitchenAt: new Date().toISOString()`, and clears `forwardToKitchenAt`.
  - **Bypasses any auto-forward hold timer** so the kitchen cooks immediately, while remaining visible to support staff in the orders system.

### 7.4 Cashier Orders Hub (Sidebar Option 2)
- **Component**: [CashierOrders.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/CashierOrders.tsx)
- **Navigation**: Registered as `{ id: 'staff-cashier-orders', label: 'Orders Hub', icon: ShoppingBag }` in [StaffLayout.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/StaffLayout.tsx) and routed in [page.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/app/staff/page.tsx).
- **Header Clean-Up**:
  - The previous header block (`Orders Hub`, `Gulberg Branch (Flagship)` badge, and `Real-time Order Statuses · Kitchen Progress · Cashier Verification`) has been **completely removed**.
- **Unified Top Control Bar with Inline Search**:
  - All category tabs, the search input, and the status filter pills are unified in a single, compact top bar:
    `[Dine-In Orders] [Takeaway Orders] [Delivery Orders] [ 🔍 Search by order #, customer, table... ] [ALL] [ARRIVED] [PREPARING] [READY] [COMPLETED]`
  - The search input is positioned **strictly between** the `Delivery Orders` tab and the `ALL` / `ARRIVED` filter pills.
- **Scoped Visibility**: Cashier strictly sees orders placed by them for customers (walk-in counter orders), completely separating them from online customer-web orders.
- **Uniform Order Cards**:
  - Cards have fixed, identical dimensions (`340px × 185px`).
  - **No inline menu items text listed directly on the card face** to prevent uneven card heights.
  - Card face displays: Order #, Status badge, Table # / Pickup / Address, Customer Name & Phone, Total Price, `📦 X Items (Click to View)`, Kitchen status (`Direct Kitchen Sent`), and Payment badge (`PAID` / `UNPAID CASH`).
- **Order Detail Pop-Up Screen**:
  - Clicking any card opens a pop-up modal showing the full itemized dishes breakdown, portions, extras, notes, pricing breakdown, kitchen dispatch timestamps, receipt printing, and quick settlement action for unpaid orders.

---

## 8. Master Reference: Every Single Left-Slide Navigation Option by Staff Role

This section documents **every single sidebar navigation option** across all 6 staff roles. Any AI agent reading this will know exactly which file powers each view, what the view does, its scrolling constraints, its header formatting, and its interactive workflows.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   STAFF PORTAL ROLES & SCREENS                                   │
├──────────────────────┬────────────────────────────────────────┬──────────────────────────────────┤
│ ROLE                 │ SIDEBAR LABEL & ID                     │ COMPONENT & FILE                 │
├──────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ platform_owner       │ 1. Owner Overview (mgmt-overview)      │ OwnerOverview.tsx                │
│                      │ 2. Branches & Staff (mgmt-branches)    │ BranchesAndStaff.tsx             │
│                      │ 3. Menu & Prices (mgmt-menu)           │ MenuAndPrices.tsx                │
│                      │ 4. Financial & Cash (mgmt-reports)     │ ReportsAndReconciliation.tsx     │
│                      │ 5. Audit Log (mgmt-audit)              │ AuditLogView.tsx                 │
│                      │ 6. Customers & Orders (mgmt-customers) │ CustomersAndOrders.tsx           │
├──────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ branch_manager       │ 1. Manager Overview (staff-manager)    │ BranchManagerDashboard.tsx       │
│                      │ 2. Menu, Categories & Services         │ MenuAndPrices.tsx                │
│                      │ 3. Kitchen Monitor (staff-kitchen)     │ KitchenQueue.tsx                 │
│                      │ 4. Cash Desk Monitor (staff-cashier)   │ CashierDesk.tsx                  │
│                      │ 5. Floor & Seating (staff-floor)       │ FloorTables.tsx                  │
│                      │ 6. Customer Support (staff-rep)        │ RepresentativeInbox.tsx          │
│                      │ 7. Dine-In Orders (staff-rep-dinein)   │ RepresentativeInbox.tsx          │
│                      │ 8. Takeaway Orders (staff-rep-takeaway)│ RepresentativeInbox.tsx          │
│                      │ 9. Delivery Orders (staff-rep-delivery)│ RepresentativeInbox.tsx          │
├──────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ cashier              │ 1. Cashier Desk (staff-cashier)        │ CashierDesk.tsx                  │
│                      │ 2. Orders Hub (staff-cashier-orders)   │ CashierOrders.tsx                │
├──────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ branch_representative│ 1. Dine-In Orders (staff-rep-dinein)   │ RepresentativeInbox.tsx          │
│                      │ 2. Takeaway Orders (staff-rep-takeaway)│ RepresentativeInbox.tsx          │
│                      │ 3. Delivery Orders (staff-rep-delivery)│ RepresentativeInbox.tsx          │
│                      │ 4. Customer Support (staff-rep)        │ RepresentativeInbox.tsx          │
│                      │ 5. Menu (mgmt-menu)                    │ MenuAndPrices.tsx                │
├──────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ kitchen_staff        │ 1. Kitchen Queue (staff-kitchen)       │ KitchenQueue.tsx                 │
├──────────────────────┼────────────────────────────────────────┼──────────────────────────────────┤
│ floor_staff          │ 1. Floor Tables Grid (staff-floor)     │ FloorTables.tsx                  │
└──────────────────────┴────────────────────────────────────────┴──────────────────────────────────┘
```

---

### 8.1 Role: Cashier (`currentRole === 'cashier'`)
The Cashier portal is built for point-of-sale checkout, cash till drawer reconciliation, and walk-in counter ordering.

#### Option 1: `Cashier Desk` (`id: 'staff-cashier'`)
- **File**: [CashierDesk.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/CashierDesk.tsx)
- **Title**: Cleanly titled **Cashier Desk** (no ` & Shifts`, no subtitle line).
- **Shift Summary Quick Panel (Pinned Statically)**:
  - `Shift Status: 🟢 ACTIVE SHIFT OPEN` (or `🔴 SHIFT CLOSED`)
  - `Opening Float (Cash In Till): Rs. 5,000`
  - `Cash Collected Today: Rs. 34,200` (live updating with database persistence)
  - `Expected Till Total: Rs. 39,200` (live updating with database persistence)
  - Shift Action Buttons: `+ Walk-in Order` and `Close Shift (Reconcile Cash)` / `Open Cash Shift`.
- **Shift Persistence Rule**:
  - `recordCashPayment` dispatches `PATCH /api/shifts` with `{ shiftId, cashCollected, expectedCash }` directly to the PostgreSQL `cash_shifts` table.
  - The 3-second database polling routine preserves the newly incremented cash figures without reverting to 34,200.
- **Cashier-Scoped Orders Visibility**:
  - Cashier **only sees orders placed by them for customers** (walk-in counter orders where `cashierId === currentUser.id` or `isWalkIn === true`).
  - Online web orders placed by remote customers are completely hidden from the cashier's desk.
- **Payment Settlement Workstation (Scrolls Internally)**:
  - Select an order from the cashier's list to view dish breakdown, original subtotal, Stage 2 add-ons subtotal, and total due.
  - **Payment Underpayment Protection**: Cash input requires full bill amount. If cash entered is less than total bill, a red underpayment warning is displayed and `Record Cash Payment` is completely disabled / unclickable.
  - Full payment displays calculated change due and enables the green action button.
  - Print POS Receipt button (80mm thermal receipt iframe with 135° cafe logo watermark).
  - Request Refund button opens refund request dialog sent to Branch Manager.
- **Walk-in Order Flow (`+ Walk-in Order`)**:
  - Step 1: Customer-web interactive menu modal with live search, category tabs, dish photos, descriptions, and active quantity steppers.
  - Step 2: Checkout configuration:
    - Fulfillment Type: `Dine-In`, `Takeaway`, or `Delivery`.
    - Dine-In Table Picker: Dropdown showing only tables with `status === 'available'` for the active branch.
    - Customer Info: Name and mobile number.
    - Delivery Address (if Delivery).
    - Mode of Payment: `Pay Cash Now (Paid)` or `Pay After Meal / At Till (Unpaid)`.
  - **Direct Kitchen Dispatch**: Dispatches directly via `sendOrderToKitchen(placed.id)` with `sentToKitchen: true` — **bypasses any hold timer** so the kitchen cooks immediately.

#### Option 2: `Orders Hub` (`id: 'staff-cashier-orders'`)
- **File**: [CashierOrders.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/CashierOrders.tsx)
- **Header Clean-Up**: Completely removed `Orders Hub`, `Gulberg Branch (Flagship)` badge, and `Real-time Order Statuses · Kitchen Progress · Cashier Verification`.
- **Unified Top Control Bar**:
  - Positioned at top: 3 Category Tabs (`Dine-In Orders`, `Takeaway Orders`, `Delivery Orders`), followed by the **Search input**, followed by the Sub-status filter pills (`ALL`, `ARRIVED`, `PREPARING`, `READY`, `COMPLETED`).
  - The search input sits **strictly between** `Delivery Orders` and `ALL` / `ARRIVED`.
- **Scoped Visibility**: Displays only orders placed by the cashier for customers.
- **Uniform Cards Grid**: Fixed dimensions (`340px × 185px`), zero inline items on card face. Clicking opens full itemized pop-up modal with status timestamps and receipt printing.

---

### 8.2 Role: Branch Representative (`currentRole === 'branch_representative'`)
The Branch Representative is the frontline customer support, kitchen-dispatch expediter, and order handover controller.

#### Option 1: `Dine-In Orders` (`id: 'staff-rep-dinein'`)
- **File**: [RepresentativeInbox.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/RepresentativeInbox.tsx) (`initialTab="dine_in"`)
- **Sidebar Badge**: Clean numeric count of active dine-in orders (e.g. `(3)`), word "Active" removed.
- **Static Layout**: Pinned directly below the 60px header (`height: calc(100vh - 60px)`, `overflow: hidden`). Zero page scroll.
- **Order Cards**: Uniform dimension cards (`340px × 185px`) without inline menu items. Clicking opens the detailed Order Pop-up Screen.
- **Incoming Order Actions (No "Auto Forward" Text)**:
  - Cards strictly display **Cancel**, **Mark Kitchen Ready**, and **Set Timer** (showing remaining time only e.g. `⏱️ 02:45` without extra text labels).
  - Clicking `Set Timer` opens a pop-up with a 2-option radio card:
    1. **"This Order"**: Sets countdown timer for this order only.
    2. **"Whole Orders"**: Sets timer for all pending orders and updates global auto-forward dispatch time.

#### Option 2: `Takeaway Orders` (`id: 'staff-rep-takeaway'`)
- **File**: [RepresentativeInbox.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/RepresentativeInbox.tsx) (`initialTab="takeaway"`)
- **Sidebar Badge**: Clean count of ready takeaway orders waiting for collection.
- **Handover Control**: Kitchen-ready packed takeaway orders display customer name, phone link, and cash status.
- **Action**: One-click **"Hand Over to Customer ✓"** transitions order status to `completed`.

#### Option 3: `Delivery Orders` (`id: 'staff-rep-delivery'`)
- **File**: [RepresentativeInbox.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/RepresentativeInbox.tsx) (`initialTab="delivery"`)
- **Sidebar Badge**: Clean count of ready delivery orders.
- **Rider Shipping Control**: Displays delivery address, phone link, and COD amount.
- **Actions**: Sequential buttons **"Dispatch with Rider →"** (sets status to `out_for_delivery`) and **"Mark Delivered & Completed ✓"** (sets status to `completed`).

#### Option 4: `Customer Support` (`id: 'staff-rep'`)
- **File**: [RepresentativeInbox.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/RepresentativeInbox.tsx) (`initialTab="support"`)
- **Sidebar Renaming**: Renamed from "Customer Services" to **Customer Support**.
- **Sidebar Badge**: Pop-up colored status dot when pending unresolved complaints exist (words "Action Req" removed).
- **Static 3-Card Layout**: Pinned directly below header (`calc(100vh - 60px)`). The outer cards do not scroll; all vertical scrolling is isolated within internal sub-containers:
  - **Card 1: Customers / Inquiries List**:
    - Header and search input pinned at top.
    - Customer list scrolls internally.
    - Priority sorting: Unresolved tickets float to top in crimson red with unread badge (`● X New`).
    - Status dot on avatar indicates unresolved matter (redundant text words `resolved`/`unresolved` removed).
    - Clicking customer automatically opens conversation and **scrolls straight to the first unseen message**.
  - **Card 2: Direct 1-on-1 Live Chat**:
    - Profile header pinned at top.
    - Messages feed scrolls internally.
    - **No sender names** above message bubbles.
    - Bubbles display **time only** (`12:45 PM`).
    - Date divider (`Today`, `Yesterday`) is written centered once per day **strictly above the inquiry ticket line** (`Inquiry #TKT-xxxx · Inquiry on Order #FC-xxxx`).
    - When an inquiry is solved, a centered banner displays: `✓ Matter has been resolved`.
    - Future messages continue seamlessly below the resolved banner in chronological order.
    - Reply composer and quick canned responses pinned statically at card bottom.
  - **Card 3: Customer Order History**:
    - Customer's orders list scrolls internally.
    - Word "menu" removed from cards (replaced by clean icon button).
    - Clicking any order opens the full itemized ordered dishes pop-up modal.

#### Option 5: `Menu` (`id: 'mgmt-menu'`)
- **File**: [MenuAndPrices.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/MenuAndPrices.tsx)
- **Sidebar Renaming**: Renamed from "Customer Services & Menu Manager" to **Menu**.
- **Static Layout**: Static card pinned directly beneath categories bar. Category filter pills are fixed at top; dishes table scrolls internally beneath it with sticky column headers.
- **Functionality**: View branch dishes, edit prices (with manager approval workflow if restricted), toggle branch availability.

---

### 8.3 Role: Branch Manager (`currentRole === 'branch_manager'`)
The Branch Manager oversees branch profitability, authorizes cash drawer reconciliations, reviews customer escalations, and approves refunds.

- **Edit Permission Rule**: Changes are permitted **ONLY in the first 2 options** (`canEdit: true`). Options 3 through 9 run in dedicated **oversight and monitor mode** (`canEdit: false`), disabling inline edit/operational controls.
- **Sidebar Action-Required Badges**: Pulsing amber badge (`⚠️ ACTION REQ (X)`) highlights any option requiring manager decision (pending refunds, unresolved complaints, banner approvals).

#### Option 1: `Manager Overview` (`id: 'staff-manager'`)
- **File**: [BranchManagerDashboard.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/BranchManagerDashboard.tsx)
- **Live Branch Analytics**: Total revenue today, live order count, active seated tables, on-duty staff count.
- **Pending Refund Requests**: List of customer refund requests forwarded by Cashier Desk with customer name, order number, amount, and reason. Features 1-click **"Approve Refund ✓"** (updates DB, sets payment to `refunded`) and **"Reject Refund ✗"** actions.
- **Marketing & Banner Approvals**: Queue of deal cards and banner changes submitted by staff waiting for manager authorization.

#### Option 2: `Menu, Categories & Customer Services` (`id: 'mgmt-menu'`)
- **File**: [MenuAndPrices.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/MenuAndPrices.tsx) (`canEdit: true`)
- **Tab 1: Menu Items Catalog**:
  - Add new dish with name, category, base price, image URL, description, dietary tags (Spicy, Chef Special).
  - Edit prices and branch price overrides with immediate 0ms broadcast across all customer storefronts and PostgreSQL sync.
  - Toggle dish availability (in stock / out of stock).
- **Tab 2: Category Management**:
  - Add category, rename category (cascades automatically to all menu items in PostgreSQL), delete category.
- **Tab 3: Deals & Hero Banners**:
  - Manage 2-second home carousel slides, button links, and 3D interactive Chef's Special Deal card.
- **Tab 4: Customer Services & Order Routing**:
  - Master toggle: `Route Customer Orders Directly to Customer Services First`.
  - Auto-forward countdown duration presets (`1m`, `2m`, `3m`, `5m`, `10m`, `15m`, custom minutes).
  - Forwarding mode selection: `Auto-Forward to Kitchen after Timer` vs `Manual Verification Required`.
  - Customer Footer Settings: Helpline number, support email, operating hours, branch addresses (Lahore, Islamabad, Karachi), and cafe tagline.

#### Option 3: `Kitchen Monitor` (`id: 'staff-kitchen'`)
- **File**: [KitchenQueue.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/KitchenQueue.tsx) (`canEdit: false`)
- **Executive Read-Only KDS Monitor**:
  - 4 Live KPI Cards: Orders Came Today, Orders Accepted, Orders Prepared, Currently Cooking.
  - Active orders list with item details, table numbers, elapsed timers. Cooking action buttons are cleanly hidden.

#### Option 4: `Cash Desk Monitor` (`id: 'staff-cashier'`)
- **File**: [CashierDesk.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/CashierDesk.tsx) (`canEdit: false`)
- **Cashier & Date Filtering**: Filter by cashier (`All Cashiers`, `Bilal Farooq`, `Tariq Jamil`) and date range (`Today`, `Yesterday`, `Last 7 Days`, `Custom`).
- **Tab 1: Financial Calculation Reports**: 8 summary calculation cards (Total Revenue, Cash in Tills, Digital/Cards/Raast, Refunds Issued, Net Collections, Dine-In Total, Takeaway Total, Delivery Total) plus sales channel breakdown.
- **Tab 2: Per-Shift Audit History**: Audit table of every recorded shift, cashier name, opening float, cash collected, expected cash, counted actual cash, discrepancy variance (+/-), status, and shift closing notes.
- **Tab 3: Multi-Channel Order History**: Itemized order records with customer details, dish breakdown, payment status, and authentic 80mm thermal receipt printing with 135° watermark.
- **Tab 4: Refund Authorizations**: Dedicated banner for processing pending cashier refund requests.

#### Option 5: `Floor & Table Seating` (`id: 'staff-floor'`)
- **File**: [FloorTables.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/FloorTables.tsx) (`canEdit: false`)
- **Occupancy Metrics**: Tables Occupied Today, Current Occupancy Rate (%), and Average Seating Duration (minutes).
- **Table Occupancy Sessions Log**: Audit log of every seating session with Table #, Floor, Guest Name, Start Seated Time, Departed Time, Duration, Assigned Waiter, Order #, Total Bill, and Status (`Occupied Now` vs `Completed`).
- **Waiter Performance Cards**: Breakdown showing Total Orders Served Today, Active Tables currently under service, and Total Dine-in Sales billed per waiter.

#### Option 6: `Customer Support` (`id: 'staff-rep'`)
- **File**: [RepresentativeInbox.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/RepresentativeInbox.tsx) (`initialTab="support"`, `canEdit: false`)
- **Manager Oversight Mode**: Chat composer and quick canned buttons are replaced with an informative banner:  
  *"Manager Oversight Mode: Query Answering Disabled. Customer inquiries are answered directly by Support Representatives. Managers review escalations and authorize refund actions."*
- Inspect customer conversation threads, ticket history, and approve escalations.

#### Option 7: `Dine-In Orders` (`id: 'staff-rep-dinein'`)
- **File**: [RepresentativeInbox.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/RepresentativeInbox.tsx) (`initialTab="dine_in"`, `canEdit: false`)
- Oversight of branch table dining orders and kitchen dispatch status. Active count badge.

#### Option 8: `Takeaway Orders` (`id: 'staff-rep-takeaway'`)
- **File**: [RepresentativeInbox.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/RepresentativeInbox.tsx) (`initialTab="takeaway"`, `canEdit: false`)
- Oversight of counter pickup orders and collection completion. Active count badge.

#### Option 9: `Delivery Orders` (`id: 'staff-rep-delivery'`)
- **File**: [RepresentativeInbox.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/RepresentativeInbox.tsx) (`initialTab="delivery"`, `canEdit: false`)
- Oversight of rider delivery orders, addresses, and door delivery statuses. Active count badge.

---

### 8.4 Role: Kitchen Staff (`currentRole === 'kitchen_staff'`)
The Kitchen Staff operates the Kitchen Display System (KDS), tracks dish preparation stages, and manages real-time ingredient availability.

#### Option 1: `Kitchen Queue` (`id: 'staff-kitchen'`)
- **File**: [KitchenQueue.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/KitchenQueue.tsx)
- **Live KDS Progression Kanban**:
  - `Incoming Orders` (`placed` / `accepted`): Kitchen reviews order items, sizes, portions, and special notes. Clicking **"Start Preparing"** transitions order to `preparing` and shifts it to the next column.
  - `Now Preparing` (`preparing`): Chefs prepare dishes with elapsed timer display. Clicking **"Mark Ready"** transitions order to `ready`.
  - `Ready for Service` (`ready`): Hot plated food ready for server pickup. Clicking **"Mark to Serve (Send to Waiter)"** transitions status to `served` and dispatches it straight to the waiter station in `FloorTables.tsx`.
  - `Sent to Waiter` (`served`): Active dine-in orders undergoing floor service.
- **Dish Availability & Stock Management Modal**:
  - Accessed via "Dish Availability & Stock" in the top bar.
  - Kitchen staff can mark any dish "Unavailable" (out of stock/ingredients missing).
  - When restocked, click **"Remove Unavailable Status (Make Available)"** to instantly restore availability across the customer menu and cashier till in 0ms.
  - Live indicator badge in the top bar displays count of currently unavailable items.
- **Authentic 80mm KOT Ticket Printing**:
  - Kitchen Order Ticket (KOT) print button launches an isolated 80mm thermal receipt iframe with the official cafe logo watermark rotated to 135° (`opacity: 0.16`), auto-fit length, and zero browser margin clutter.

---

### 8.5 Role: Floor Staff / Waiter (`currentRole === 'floor_staff'`)
Floor staff manage dine-in table seating, verify table PINs, and deliver cooked dishes to guests.

#### Option 1: `Floor Tables Grid` (`id: 'staff-floor'`)
- **File**: [FloorTables.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/FloorTables.tsx)
- **Multi-Floor Visual Grid**:
  - Switch between floors: `Ground Floor`, `1st Floor Family Lounge`, `Rooftop Terrace`.
  - Table Status Indicators: `available` (green), `occupied` (red), `reserved` (amber), `cleaning` (blue).
  - Interactive table status buttons: "Mark Seated", "Mark Cleaning", "Mark Free".
- **4-Digit Table PIN Generator**:
  - Generates secure 4-digit PINs per table for customer-web dine-in verification and ordering authorization.
- **"Orders Ready for Server / Waiter" Workstation**:
  - Pinned workstation listing dine-in orders marked `ready` and `served` by the kitchen.
  - Displays customer name, table number (e.g. `Table T-03`), item count, and dishes breakdown.
  - Action button: **"Mark Delivered & Served to Table ✓"** transitions order status to `completed`, records seating session completion, and dispatches a success toast.

---

### 8.6 Role: Platform Owner (`currentRole === 'platform_owner'`)
The Platform Owner has enterprise-wide governance across all branches, menu pricing, financial reports, and audit logs.

#### Option 1: `Owner Overview` (`id: 'mgmt-overview'`)
- **File**: [OwnerOverview.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/OwnerOverview.tsx)
- Enterprise financial KPIs: Gross network revenue across all branches, total orders placed, average order bill, active branch count.
- Comparative branch revenue cards (Lahore vs Islamabad vs Karachi).
- Revenue and order volume trend charts.

#### Option 2: `Branches & Staff` (`id: 'mgmt-branches'`)
- **File**: [BranchesAndStaff.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/BranchesAndStaff.tsx)
- **Branch Management**: Add new branch location, edit branch details (city, address, tax percentage, phone number).
- **Branch Service Toggles**: Toggle branch operational status (Open/Closed), enable/disable Dine-In, Takeaway, and Delivery per branch.
- **Staff Accounts Administration**: Master list of staff accounts across all branches. Assign roles (`branch_manager`, `cashier`, `kitchen_staff`, `floor_staff`, `branch_representative`), reset credentials, toggle active/inactive status.

#### Option 3: `Menu & Prices` (`id: 'mgmt-menu'`)
- **File**: [MenuAndPrices.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/MenuAndPrices.tsx)
- Global dish catalog: Set enterprise base prices, configure branch-specific price overrides, create new dish categories.
- Global hero banners and Chef's Special Deal configuration.

#### Option 4: `Financial & Cash Reports` (`id: 'mgmt-reports'`)
- **File**: [ReportsAndReconciliation.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/ReportsAndReconciliation.tsx)
- Enterprise shift reconciliations table across all branches.
- Cash drawer surplus/deficit tracking, payment channel share (Cash vs Card vs Raast QR vs Mobile Wallets).
- Export financial statements to CSV / printable PDF.

#### Option 5: `Audit Log` (`id: 'mgmt-audit'`)
- **File**: [AuditLogView.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/AuditLogView.tsx)
- Immutable, searchable system audit trail capturing every staff action, price edit, branch status change, refund approval, and till reconciliation.
- Log entries record: Timestamp, Staff Name, Role, Action Type, Branch, Affected Entity, and Metadata.

#### Option 6: `Customers & Orders` (`id: 'mgmt-customers'`)
- **File**: [CustomersAndOrders.tsx](file:///home/shahwaizakram/FoodiesCafe/app/src/staff/CustomersAndOrders.tsx)
- Master customer registry: Phone numbers, customer names, registration dates, total lifetime orders, total spend.
- Complete historical order archive across all branches with search by order number, customer phone, or date.

---

## 9. Master Reference: Customer Web Application (`/`)

The Customer Web Application is accessed at `http://localhost:3000`. It is built for seamless ordering across Dine-In, Takeaway, and Delivery.

### 9.1 Fixed 72px Header (`CustomerHeader.tsx`)
- **Dimensions & Positioning**: Fixed at `top: 0; left: 0; right: 0; height: 72px; zIndex: 1000;`. `<main>` has `paddingTop: 72px` to prevent any jump or page jitter.
- **Branding**: Bold `FoodiesCafe` typography with fluid font size. Logo picture before cafe name and subtitle removed for clean elegance.
- **Controls & Navigation**:
  - **Hamburger Menu (☰)**: Opens the unscrollable slide-out navigation drawer.
  - **Branch Selector**: Located before search bar and cart. Honors manual selection and persists to `localStorage`.
  - **Header Search Bar**: Instant live filtering across dishes, auto-navigating to Menu view.
  - **Cart Button**: Fixed-width container with counter badge; adding items never shifts or displaces the header.
  - **Sign In / Profile Button**: Opens dedicated `CustomerLoginModal.tsx` or Profile modal.
- **Progressive Responsive Removal**:
  - `width <= 1024px`: Search bar hidden first.
  - `width <= 768px`: Profile button hidden second.
  - `width <= 540px`: Branch selector hidden third.
  - Small screens (< 540px): Only Hamburger (☰), Cafe Name, and Cart remain.
- **Left Alignment**: Hamburger button (☰) aligns in the exact same vertical left line with bottom cards (`20px` desktop, `12px` mobile <= 640px, `8px` <= 360px).

### 9.2 Slide-Out Navigation Drawer (☰) (`CustomerHeader.tsx`)
- **Dimensions**: Viewport height without page scroll (`overflow: hidden; height: 100vh`). Header height matches 72px with identical bottom border.
- **Profile Header**: Avatar in line horizontally with user name and phone. Clicking opens Customer Profile modal.
- **Menu Items Sequence**:
  1. **Order Menu** (`onNavigate('menu')`)
  2. **Track My Order** (`onNavigate('order-tracking')`)
  3. **Order History** (`onNavigate('order-history')`)
- **Footer Action**: Dedicated button **"Help & Contact Cafe — Chat with cafe staff"** (`onNavigate('support')`).

### 9.3 Customer Authentication & SMS OTP Modal (`CustomerLoginModal.tsx`)
- **Clean Credentials**: Full Name and Pakistani Mobile Number (`🇵🇰 +92`). No passwords, no registration forms.
- **Visual Design**: Pure light mode, cafe logo watermark background (`opacity: 0.22`), Foodies logo square, centered heading **"Sign In"** (word "Customer" removed).
- **Actions**:
  - "Send SMS Code" button with black text (`#000000`, `fontWeight: 600`) and `ArrowRight` icon.
  - Demo SMS OTP Banner (`5829`) and 4-digit code input.
  - "Confirm & Sign In" button with black text (`#000000`, `fontWeight: 600`) and `Check` icon.
  - Authenticates immediately, saves to `localStorage`, and proceeds.

### 9.4 Home Screen & Fluid Ambience (`MarketingHome.tsx`)
- **Hero Carousel**: 2-second auto-sliding banners showcasing signature dishes. No `<` or `>` arrow clutter. Clicking any slide navigates straight to that dish in the menu.
- **Exclusive Deals**: Interactive 3D Chef's Deal card directing customers directly to menu items.
- **Floating "Order Now" Action Button**: Cheezious-style floating action button fixed at bottom-right (`bottom: 28px, right: 28px`, mobile `bottom: 20px, right: 16px`) on the Home page only.
- **Small Screen Footer**: 3 columns ("Brand", "Quick Links", "Customer Support") stay side-by-side in one horizontal row down to 360px screen width. At screen width `<= 860px`, the "Branch Locations" column is hidden to preserve space. Container bottom padding stops cleanly at screen edge with zero bottom buffer.

### 9.5 Interactive Menu, Sticky Category Bar & Static Checkout Card (`CustomerMenu.tsx`)
- **Sticky Full-Width Category Bar**:
  - Positioned at `top: 72px` with tight padding (`4px 0 6px`).
  - Generic "All" category is removed; strictly displays authentic food categories, defaulting to `Appetizers`.
  - **Horizontal Auto-Scroll**: As the customer scrolls dishes vertically, ScrollSpy detects the active category, and an effect smooth-scrolls the category bar horizontally to keep the active pill centered on screen.
  - **Zero Initial Jump**: On small screens `<= 860px`, container starts immediately at `top: 72px` flush under header with zero jump on initial scroll.
- **2-Column Dishes Grid**:
  - High-res dish photos, title, price, description.
  - Dish order box (`96px`) maintains identical dimensions between "Order" button and increment/decrement stepper. Decrement renders `Trash2` delete icon when quantity is 1.
  - On mobile (`<= 640px`): Extra text (tags, descriptions) is hidden; only dish name, price, and order button are shown.
- **Desktop Static Checkout Card**:
  - Positioned sticky at `top: 126px; height: 520px; maxHeight: calc(100vh - 146px); width: 350px;`.
  - Items scroll internally within the card body (`overflow-y: auto`).
  - Container bottom padding stops scrolling cleanly above screen bottom without pulling the card upward.
- **Mobile Floating Checkout Bar**:
  - Appears on screens `<= 860px` when `cartCount > 0`. Clicking "Proceed to Checkout" opens checkout.

### 9.6 Checkout Flow & Step Modals (`CustomerCheckout.tsx`)
- **Step 1: Order Review (`order_review`)**: Itemized list, quantity steppers, subtotal. (If cart is empty and user clicks Cart in header, navigates straight to Menu without prompting for login).
- **Step 2: Sign In (`auth`)**: Appears for unauthenticated guests clicking "Proceed to Checkout". Identical to `CustomerLoginModal` with logo watermark, `+92`, demo SMS code `5829`, and black text action buttons.
- **Step 3: Fulfillment Type (`fulfillment`)**: Choose `Dine-In`, `Takeaway`, or `Delivery`.
- **Step 4: Details (`details`)**:
  - Dine-In: Available tables only dropdown (`status === 'available'`) or scan Table QR.
  - Takeaway: Pickup timing ("Now" or "Schedule Later" textarea).
  - Delivery: Delivery address, landmark, contact phone.
- **Step 5: Payment Method (`payment`)**:
  - Equal card width (`maxWidth: 540px`) matching earlier checkout steps.
  - Smoothly scrollable payment methods list (`maxHeight: 270px; overflowY: auto`).
  - Options: Cash on Delivery (COD), Debit/Credit Card, JazzCash, EasyPaisa, Raast QR, Bank Transfer, and 3-Month Installments (BNPL) if enabled by manager.

### 9.7 Dine-In Table QR & Floor Seating Selection (`CustomerTableQR.tsx` & `CustomerFloorSeatingModal.tsx`)
- **Free Tables Only**: Displays exclusively available tables (`status === 'available'`) for each floor.
- **Table Number Only**: Each table displays strictly its table number (e.g. `T-01`), with no chair counters or internal capacity text.
- **Zero Edit Tools**: Table editors, chair steppers, and layout alteration forms are completely absent.

### 9.8 Real-Time Order Tracking (`CustomerTracking.tsx`)
- Live 4-stage progression: `Order Placed` -> `Kitchen Cooking` -> `Ready for Service / Waiter` -> `Delivered`.
- **"Edit Order" Button**: Available before kitchen preparation begins. Clicking opens `CustomerOrderEdit.tsx`.
- **"Cancel Order" Button**: Functional and cancels order before kitchen prep begins.
- Customer Services verification notification banner during initial placement.

### 9.9 Stage-1 Order Editing Screen (`CustomerOrderEdit.tsx`)
- Top-left `<ArrowLeft>` back button.
- Real active ordered dishes populated from active order.
- Quantity adjustment steppers.
- Deselecting all items dynamically transforms the button into a prominent red **"Cancel Order"** button.

### 9.10 Customer Support Live Chat & Layout Lock (`CustomerSupport.tsx`)
- **Static Page Layout**: Pinned directly below header (`calc(100vh - 72px)`). Neither the page nor outer containers scroll.
- **Left Column (360px)**: "Your Orders" card (scrollable) with "Inquire About This Order" button; "Open Inquiry Threads" card (scrollable).
- **Center Live Chat Feed**:
  - Bubbles show **time only** (`12:45 PM`).
  - Date divider centered once per day **above the inquiry line** (`Inquiry #TKT-xxxx · Inquiry on Order #FC-xxxx`).
  - No sender names above bubbles.
  - Pop-up avatar dot indicates unresolved issues (words "resolved"/"unresolved" removed).
  - Auto-scrolls straight to first unseen message.
  - Centered resolved banner: `✓ Matter has been resolved`.
  - Subsequent messages continue seamlessly below the resolved banner in chronological order.
  - Reply composer pinned statically at card bottom.

### 9.11 Order History, Reordering & Isolated Thermal Printing (`CustomerHistory.tsx`)
- Order cards with official cafe logo watermark rotated at 45°.
- **"Reorder" Button**: Adds all items from that past order into the active cart and navigates to the Menu.
- **Isolated 80mm Thermal Receipt Printing**: Top-right print button launches native print exclusively on `#printable-order-receipt` via hidden iframe with 135° cafe logo watermark, auto-fit length, and zero browser margin clutter.

### 9.12 Customer Profile & Notifications Drawer (`CustomerProfile.tsx`)
- Edit Full Name, Mobile Number, and Email Address.
- Order update notifications, promotional SMS, and receipt preference toggles.
- **"Sign Out" Button**: Pinned at the very last row of the card.

### 9.13 Item Detail Customizer Pop-up (`ItemDetailModal.tsx`)
- High-res dish hero photo, title, description, price.
- Portion sizing radio options (Regular, Large, Family Pack).
- Add-on checkboxes (Extra Cheese, Extra Raita, Garlic Mayo, Double Patty).
- Special cooking instructions textarea.
- "+ Add to Order" button with dynamic price recalculation.

---

## 10. Complete System Navigation & Cross-Role Permissions Matrix

The following table provides the ultimate master reference of all views across FoodiesCafe:

| View ID | Sidebar / Screen Label | Icon | File Path | Accessible Roles | Can Edit? | Scroll Layout | Database APIs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mgmt-overview` | Owner Overview | `BarChart3` | `src/staff/OwnerOverview.tsx` | `platform_owner` | Yes | Page Scroll | `/api/orders`, `/api/branches` |
| `mgmt-branches` | Branches & Staff | `Building2` | `src/staff/BranchesAndStaff.tsx` | `platform_owner` | Yes | Page Scroll | `/api/branches`, `/api/shifts` |
| `mgmt-menu` | Menu & Prices / Menu | `UtensilsCrossed` | `src/staff/MenuAndPrices.tsx` | `platform_owner`, `branch_manager`, `branch_representative` | Owner & Manager: Yes<br>Representative: Restricted | Manager: Page Scroll<br>Representative: Static Table | `/api/menu`, `/api/marketing` |
| `mgmt-reports` | Financial & Cash Reports | `FileSpreadsheet` | `src/staff/ReportsAndReconciliation.tsx` | `platform_owner` | Yes | Page Scroll | `/api/shifts`, `/api/refunds` |
| `mgmt-audit` | Audit Log | `FileClock` | `src/staff/AuditLogView.tsx` | `platform_owner` | View Only | Page Scroll | PostgreSQL `audit_logs` |
| `mgmt-customers` | Customers & Orders | `UserCheck` | `src/staff/CustomersAndOrders.tsx` | `platform_owner` | View Only | Page Scroll | `/api/orders`, PostgreSQL `users` |
| `staff-manager` | Manager Overview | `BarChart3` | `src/staff/BranchManagerDashboard.tsx` | `branch_manager` | Yes | Page Scroll | `/api/orders`, `/api/refunds` |
| `staff-kitchen` | Kitchen Queue / Kitchen Monitor | `ChefHat` | `src/staff/KitchenQueue.tsx` | `kitchen_staff`, `branch_manager` | Kitchen: Yes<br>Manager: Monitor Only | Kanban Grid (Static Viewport) | `/api/orders`, `/api/menu` |
| `staff-cashier` | Cashier Desk / Cash Desk Monitor | `Banknote` | `src/staff/CashierDesk.tsx` | `cashier`, `branch_manager` | Cashier: Yes (POS & Shifts)<br>Manager: Oversight & Refunds | Cashier: Static Header + Internal Scroll<br>Manager: Tabbed Cards | `/api/shifts`, `/api/orders`, `/api/refunds` |
| `staff-cashier-orders` | Orders Hub | `ShoppingBag` | `src/staff/CashierOrders.tsx` | `cashier` | Yes | Static Top Bar + Internal Grid Scroll | `/api/orders` |
| `staff-floor` | Floor Tables Grid / Floor & Seating | `LayoutGrid` | `src/staff/FloorTables.tsx` | `floor_staff`, `branch_manager` | Floor: Yes (Tables & Waiter)<br>Manager: Sessions Oversight | Static Top Bar + Internal Scroll | `/api/tables`, `/api/tables/sessions` |
| `staff-rep` | Customer Support | `MessageSquare` | `src/staff/RepresentativeInbox.tsx` | `branch_representative`, `branch_manager` | Representative: Yes (Chat & Handover)<br>Manager: Escalations Only | Static 3-Card Viewport (Zero Page Scroll) | `/api/complaints`, `/api/orders` |
| `staff-rep-dinein` | Dine-In Orders | `Utensils` | `src/staff/RepresentativeInbox.tsx` | `branch_representative`, `branch_manager` | Expedite & Timer | Static Viewport + Internal Scroll | `/api/orders` |
| `staff-rep-takeaway` | Takeaway Orders | `ShoppingBag` | `src/staff/RepresentativeInbox.tsx` | `branch_representative`, `branch_manager` | Counter Handover | Static Viewport + Internal Scroll | `/api/orders` |
| `staff-rep-delivery` | Delivery Orders | `Bike` | `src/staff/RepresentativeInbox.tsx` | `branch_representative`, `branch_manager` | Rider Dispatch | Static Viewport + Internal Scroll | `/api/orders` |
| `staff-auth` | Staff Sign In Portal | `Lock` | `src/staff/StaffAuth.tsx` | All Staff Roles | Yes | Static Modal Fit | Client Auth + Role Switcher |
| `home` | Customer Home | `Flame` | `src/customer/MarketingHome.tsx` | Customer | Yes | Page Scroll | `/api/marketing`, `/api/menu` |
| `menu` | Customer Order Menu | `UtensilsCrossed` | `src/customer/CustomerMenu.tsx` | Customer | Yes | Sticky Category Bar + Static Checkout Card | `/api/menu` |
| `table-qr` | Dine-In Table Picker | `QrCode` | `src/customer/CustomerTableQR.tsx` | Customer | Yes | Modal Fit | `/api/tables` |
| `order-tracking` | Order Tracking | `Clock` | `src/customer/CustomerTracking.tsx` | Customer | Yes | Centered Progress Layout | `/api/orders` |
| `order-edit` | Stage-1 Order Editing | `Edit3` | `src/customer/CustomerOrderEdit.tsx` | Customer | Yes | Centered Card Layout | `/api/orders` |
| `order-history` | Order History & Receipts | `Receipt` | `src/customer/CustomerHistory.tsx` | Customer | Yes | Page Scroll + Isolated Print | `/api/orders` |
| `support` | Customer Support Live Chat | `Headphones` | `src/customer/CustomerSupport.tsx` | Customer | Yes | Static Viewport (`calc(100vh - 72px)`) | `/api/complaints`, `/api/orders` |
| `profile` | Customer Profile | `User` | `src/customer/CustomerProfile.tsx` | Customer | Yes | Self-Contained Modal Fit | LocalStorage / Context |

---

## 11. Golden Developer Rules & Anti-Regression Checklist for Future Agents

When modifying or expanding FoodiesCafe in future sessions, verify each of these requirements before completing work:

1. **Light Mode Only**: Never add dark mode styles, media queries for dark mode, or theme toggle buttons.
2. **Never Mention "KFC"**: Maintain authentic FoodiesCafe branding across all customer and staff UI.
3. **Cashier Orders Scoping**: The Cashier portal must **only show walk-in orders placed by that cashier** (`isWalkIn === true` or `cashierId === currentUser.id`), never remote online customer orders.
4. **Cashier Desk Shift Synchronization**: When `recordCashPayment` is called, it must dispatch `PATCH /api/shifts` to PostgreSQL `cash_shifts` to ensure the 3-second database polling does not revert cash figures back to default.
5. **Billing Underpayment Guard**: The `Record Cash Payment` button must remain completely disabled and unclickable whenever cash tendered is less than the total bill.
6. **Cashier Orders Search Bar Position**: In `CashierOrders.tsx`, the search bar must sit **strictly between** the `Delivery Orders` category tab and the `ALL` / `ARRIVED` filter pills.
7. **Uniform Order Cards**: In `CashierOrders.tsx` and `RepresentativeInbox.tsx` (Options 1–3), order cards must have fixed dimensions (`340px × 185px`) with zero inline dishes text on the card face. Full items must open in a pop-up modal on click.
8. **Static Layouts with Internal Scrolling**:
   - `CustomerSupport.tsx`: Pinned at `calc(100vh - 72px)`. Zero outer page scroll.
   - `RepresentativeInbox.tsx`: Pinned at `calc(100vh - 60px)`. Zero outer page scroll.
   - `CashierDesk.tsx`: Header pinned at top; only bottom lists scroll internally.
9. **Support Live Chat Formatting**:
   - Date divider centered once per day **strictly above the inquiry ticket line**.
   - Message bubbles show **time only** (`12:45 PM`).
   - No sender names above bubbles.
   - Status dot on profile avatar indicates unresolved issues (words "resolved"/"unresolved" removed).
   - Resolved divider banner: `✓ Matter has been resolved`. Continuous thread below it.
   - Auto-scroll straight to first unread message.
10. **Awaiting Kitchen Order Controls**:
    - Cards strictly display **Cancel**, **Mark Kitchen Ready**, and **Set Timer** (countdown timer only e.g. `⏱️ 02:45`, no "Auto Forward" label).
    - Clicking `Set Timer` opens 2-option modal ("This Order" vs "Whole Orders").
11. **Walk-in Kitchen Dispatch**: Walk-in orders placed by cashier dispatch directly to kitchen queue (`sendOrderToKitchen`), bypassing any hold timers.
12. **Authentic 80mm Printing with 135° Watermark**: All receipts (Customer History, Cashier POS) and KOT tickets (Kitchen) print via isolated iframe with `@page { size: 80mm auto; margin: 0; }` and cafe logo watermark rotated at 135°.
13. **Type Checking & Linting**: Always run `npm --prefix app exec tsc -- --noEmit` before finishing to guarantee zero TypeScript compiler errors.
14. **Table Occupancy Persistence & Auto-Freeing**:
    - When a customer places a Dine-In order for Table X, Table X must be immediately marked `occupied` in local state, broadcast, and persisted to PostgreSQL (`PATCH /api/tables` and `POST /api/orders`).
    - The 2.5-second polling routine in `AppContext.tsx` cross-references active dine-in orders (`status !== 'completed' && status !== 'cancelled'`) so tables never revert to `available` while an active session exists.
    - When an order transitions to `completed` or `cancelled`, the linked table is automatically restored to `available` in state, broadcast, and database.
15. **Same-Account Order Merging**:
    - **Dine-In**: If a customer places an order while their first Dine-In order is still pending (`status !== 'completed' && status !== 'cancelled'`), new items are merged directly into that same order, updating the version and add-on subtotals without generating duplicate orders.
    - **Takeaway & Delivery**: If a customer places an order while their first order of that type is not handed over (`status !== 'completed' && status !== 'cancelled'`), new items are merged into that same active order.
    - `CustomerCheckout.tsx` detects active orders for the selected fulfillment type, shows an `"Active Order Detected"` banner, auto-locks to the existing table for Dine-In, and updates the confirm button to `"Add to Order #XXXX"`.
16. **Dual-Card Scrollable Order Tracking (`CustomerTracking.tsx`)**:
    - The tracking screen is housed in a single master cohesive card (`.foodies-tracking-master-card`).
    - **Left Side**: Scrollable current orders card (`overflow-y: auto`) displaying all current active orders with 135° cafe logo watermark, Order #, fulfillment badge, status badge, updated badge, item preview, and total price.
    - **Right Side**: Scrollable detail card (`overflow-y: auto`) displaying the complete order details: dynamic contextual notification banner, 5-stage progression stepper, countdown estimate, itemized dishes breakdown (original items + Stage 2 add-ons), fulfillment details, and action buttons.
    - Responsive adaptivity: On mobile/tablet (`<= 900px`), stacks cleanly with a horizontal scrollable order selector at the top and the full detail card below.

17. **Static Order History Layout with Scrollable Sub-Cards (`CustomerHistory.tsx`)**:
    - The main order history container card is static (`height: calc(100vh - 105px)`, `overflow: hidden`), eliminating full-page scrolling.
    - **Left Sub-Card**: Scrollable orders list card (`overflow-y: auto`) displaying past orders with 135° cafe logo watermark, Order #, fulfillment badge, date/time, and price.
    - **Right Sub-Card**: Scrollable itemized printable cash receipt card (`#printable-order-receipt`, `overflow-y: auto`) with sticky print button and full itemized pricing breakdown.
    - **Text Removals**: Header strictly displays **"Order History"** (removed `" & Itemized Receipts"` and removed explanatory paragraph `"Historical price snapshots are permanently preserved. Cash-only receipts."`).
18. **Customer Header Cleanup & Dedicated Menu Search**:
    - **Header Cleanup (`CustomerHeader.tsx`)**: Removed the branch location selector and the search option from the customer header. Header right actions cleanly display only Cart and Account/Profile buttons.
    - **Dedicated Menu Search (`CustomerMenu.tsx`)**: The search input (`"Search dishes..."`) is located on the customer menu page category filter bar line, filtering dishes dynamically with a clear button.
19. **Order Tracking Header Polish (`CustomerTracking.tsx`)**:
    - Removed the subtitle line `"Real-time kitchen progress, dish preparation & order updates · {currentBranch.name}"` below the tracking header.

20. **Order Tracking Header & Scroll Constraints (`CustomerTracking.tsx`)**:
    - Title is strictly **"Order Status"** (removed `" & Real-time Progress"`).
    - The master container card is static (`height: calc(100vh - 105px)`, `overflow: hidden`). When scrolling the left order list, the outer card does not scroll. Only the orders list sub-card (`overflow-y: auto`, `overscroll-behavior: contain`) scrolls if there are enough orders to require scrolling.
21. **Flying Add-to-Cart Animation (`CustomerMenu.tsx` & `CustomerHeader.tsx`)**:
    - When an item is added to cart (via dish card, "+ Add" / "Order" button, or stepper "+" button), a small flying badge animates smoothly from the source item to the header cart button (`.header-cart-button`) in ~420ms (`cubic-bezier(0.2, 0.8, 0.25, 1)`).
    - Only after the flying badge lands at the cart button is the cart state updated and the cart button triggers a pulse bounce animation (`.cart-bounce-pulse`).
22. **Customer Web Transitions & Left Slide Drawer Animations (`CustomerHeader.tsx` & `app/page.tsx`)**:
    - The left slide-out drawer has smooth CSS transitions (`transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)`) for both opening (`translateX(0)`) and closing (`translateX(-100%)`), alongside smooth backdrop opacity transitions (`opacity 0.24s ease`).
    - Customer page view transitions feature smooth entry animations (`@keyframes customerPageTransition`, `opacity: 0 -> 1`, `translateY(6px) -> translateY(0)`).
23. **Floor Staff Main Card & Layout Architecture (`FloorTables.tsx`)**:
    - Header is strictly **"Floor Staff"** (removed `" — Live Table Management"` and removed the subtitle paragraph `"Branch: ... Live physical table status synchronization"`).
    - Main card is static (`height: calc(100vh - 85px)`, `overflow: hidden`, zero outer page scroll).
    - **Left Sub-card**: Orders ready for server / waiter (`width: 370px`, `overflow-y: auto`, `overscroll-behavior: contain`).
    - **Right Sub-card**: Dining room layout table chart and selected table options (`overflow-y: auto`, `overscroll-behavior: contain`).
    - Table options support all statuses: Mark Seated / Occupied, Mark Cleaning, Mark Reserved, and Mark Table Free (with confirmation popup), plus `+ New Walk-in Order (Table X)`.
24. **Floor Staff Walk-in Orders & Orders Hub (`WalkInOrderModal.tsx`, `CashierOrders.tsx`, `StaffLayout.tsx`)**:
    - Floor staff have a dedicated `+ Walk-in Order` button in both the header and selected table options, opening `WalkInOrderModal` directly for table seating and direct kitchen queue dispatch.
    - 2nd option in Floor Staff left sidebar is **"Orders Hub"** (`staff-floor-orders`), displaying his concerned orders with active badge counter.
    - In Orders Hub, the main card is static, search input sits in the **top right corner** (`marginLeft: 'auto'`), only the order cards scroll internally, and itemized dish details remain hidden until clicked into a detail modal.
25. **Strict Dine-In Only & Removal of Fulfillment Names for Floor Staff (`WalkInOrderModal.tsx`, `CashierOrders.tsx`, `StaffLayout.tsx`)**:
    - For floor staff person, Takeaway and Delivery options are completely removed.
    - Because floor staff only handles table seating (dine-in), none of the 3 names (`Dine-In`, `Takeaway`, `Delivery`) are written in the floor person views:
      - In `WalkInOrderModal.tsx`: The 3 fulfillment type switcher buttons are completely hidden for floor staff, directly presenting table seating selection (`"Select Table for Seating:"`).
      - In `CashierOrders.tsx`: The 3 category tabs (`Dine-In Orders`, `Takeaway Orders`, `Delivery Orders`) are completely hidden for floor staff, and order cards display table numbers (`Table #X`) without fulfillment labels.
      - In `StaffLayout.tsx`: The Orders Hub badge strictly counts active dine-in orders (`o.type === 'dine_in'`).

26. **Manager Profile Left Slide Options & Scrollable Data Architecture (`StaffLayout.tsx`, `app/src/app/staff/page.tsx`)**:
    - **Issue Resolved**: Previously, some left slide options in the manager profile (e.g. Cash Desk Monitor, Floor & Table Seating Oversight, Menu & Prices, Customer Support lifecycles) either locked up, cut off at the bottom, or appeared stuck because the layout container hardcoded `overflowY: 'hidden'` intended only for the fixed three-pane representative view.
    - **Fix Implemented**:
      - In `StaffLayout.tsx`, `isStaticWorkspace` is bypassed when `currentRole === 'branch_manager'`.
      - The `<main>` element has `overflowY: 'auto'` with `height: 'calc(100vh - 60px)'`, `maxHeight: 'calc(100vh - 60px)'`, and `minHeight: 0`.
      - In `app/src/app/staff/page.tsx`, every view inside `renderStaffContent()` is assigned a unique `key={currentView}`, preventing React from reusing dirty component state when navigating between tabs.
      - All manager screens (`BranchManagerDashboard`, `BranchStaffManagement`, `MenuAndPrices`, `CashierDesk`, `FloorTables`, `RepresentativeInbox`) now open smoothly with fully scrollable content whenever data exceeds the viewport height.

27. **Today-Only Data by Default (Fast Performance Mode) & On-Demand Older Data Fetching**:
    - **Core Concept**: To make the web application lightning fast, detailing (orders, till transactions, calculation reports, completed lifecycles) only queries and renders **Today's data** by default.
    - **PostgreSQL API Optimization (`api/orders/route.ts`)**:
      - `GET /api/orders` accepts `dateScope=today` (default) vs `dateScope=all` (`older=true`).
      - Default query only retrieves records matching `created_at >= (NOW() - INTERVAL '24 hours') OR status IN ('placed', 'accepted', 'preparing', 'ready', 'served', 'out_for_delivery')` with `LIMIT 100`.
      - Only when the manager explicitly clicks "Fetch Older Records" or queries all history (`dateScope=all`), older database archive records are loaded (`LIMIT 300`).
    - **Central State Management (`AppContext.tsx`)**:
      - Exposes `hasLoadedOlderOrders: boolean`, `isFetchingOlderOrders: boolean`, `fetchOlderOrders(): Promise<void>`, and `filterOrdersToToday(): void`.
    - **Manager Dashboard & Screens UI**:
      - `BranchManagerDashboard.tsx`: Displays top Fast Performance bar (`⚡ Fast Mode: Today Only` or `📂 Full Historical Data`) and filters order metrics strictly to today. Provides `[📂 Fetch Older Data ⬇]` and `[Show Today Only ⚡]` buttons.
      - `RepresentativeInbox.tsx`: Takeaway, Delivery, and Dine-In completed tabs display today's completed orders with an on-demand button `[📂 Fetch Older Records ⬇]` to load archive records without slowing down the initial page load.

28. **Standards-Compliant ISO/IEC 18004 QR Codes (`TableQrCodeSvg.tsx`, `TableQrModal.tsx`, `CustomerTableQR.tsx`)**:
    - All on-table and cashier-generated QR codes must use authentic Reed-Solomon error-corrected QR standards (`qrcode` library with Level H redundancy, 30% error correction).
    - Never use pseudo-random bit generators or mock visual squares.
    - Include at least a 3-module quiet zone (white margin) around the QR matrix so Google Scanner, Google Lens, iOS Camera, and barcode scanners can identify the finder patterns against any background.
    - Cashier Table QR Generator provides high-res PNG download, offline print generation without external API dependencies, brand badge toggle, and base domain configuration.

29. **Small Screen Customer Web Polish, Unified Pop-up Drawer & 2-Item Scrollable Checkout**:
    - **Customer Home Screen (`MarketingHome.tsx` & `globals.css`)**: On small screens (`<= 768px`), the `"View Full Menu"` button is cleanly removed (`.home-view-full-menu-btn { display: none !important; }`), keeping the mobile home hero uncluttered.
    - **Customer Menu Card Simplification (`CustomerMenu.tsx`)**:
      - On small screens (`<= 860px`), items strictly display only the item photo and item name.
      - Removed Description / Recipe Details (`.dish-desc`), Category badge (`.dish-cat-badge`), and Price (Cash) label (`.dish-price-label`).
      - In the action row, `Rs. {displayPrice}` and the `+ Order` button are placed side-by-side in the exact same row.
      - **Isolated Click Behavior**: Removed card-level `onClick` and card active scale animations. Clicking the card does not activate the card; clicking the `+ Order` button or stepper animates only that specific order box (`transform: scale(0.92)`).
    - **Universal Mobile Bottom-Drawer Modal Design (`globals.css`)**:
      - On mobile screens (`<= 768px`), the web checkout modal and all customer pop-up screens (`CustomerCheckout.tsx`, `CustomerLoginModal.tsx`, `CustomerFloorSeatingModal.tsx`, `StoreMapModal.tsx`, `ItemDetailModal.tsx`) adopt the Table QR scanner checkout bottom-drawer design (`align-items: flex-end`, sliding up from bottom with `border-top-left-radius: 24px`, `border-top-right-radius: 24px`, and `animation: slideUpDrawer 0.25s cubic-bezier(0.16, 1, 0.3, 1)`).
    - **Compact 2-Item Scrollable Selected Items Card (`CustomerCheckout.tsx`)**:
      - In the order review step (`order_review`), the selected items list container is constrained (`maxHeight: '112px'`, `overflowY: cart.length > 2 ? 'auto' : 'hidden'`), displaying exactly 2 items at a time and scrolling vertically if 3 or more items are present.
      - The outer card container is compact (`height: 'auto'`, `maxHeight: '235px'`), strictly sized so the screen size is not bigger than that.
    - **Preserved Branch Locator (`CustomerCheckout.tsx`)**:
      - The branch locator step (`branch_map`) retains its existing pop-up card layout, dimensions (`height: clamp(250px, 48vh, 310px)`), split store list (~28%), directional route lines, and 100% of its existing text and content.

---

## 13. Master Changelog: Flying Cart Animation, Tracking Scroll, Floor Staff Hub & Walk-in Orders

| Feature | Component / File | Behavior & Solution |
| :--- | :--- | :--- |
| **Order Tracking Header & Scroll Fix** | `CustomerTracking.tsx` | • Cleaned title strictly to `"Order Status"` (removed `" & Real-time Progress"`).<br>• Master card fixed at `calc(100vh - 105px)` with `overflow: hidden`.<br>• Only left order list sub-card scrolls (`overscroll-behavior: contain`) when order count exceeds visible bounds. Outer page never scrolls. |
| **Snappy Flying Add-to-Cart Animation** | `CustomerMenu.tsx`<br>`CustomerHeader.tsx` | • Clicking "+ Add", dish card, or stepper "+" launches a glowing particle flying to `.header-cart-button` in 420ms.<br>• Cart updates and bounces (`.cart-bounce-pulse`) only upon landing. |
| **Drawer & Page Transition Animations** | `CustomerHeader.tsx`<br>`app/src/app/page.tsx` | • Customer navigation drawer slides in/out smoothly from left (`translateX(0)` to `translateX(-100%)`) with fading backdrop on both open and close.<br>• Page transitions across customer views feature smooth fade and subtle lift (`@keyframes customerPageTransition`). |
| **Floor Staff Static Card & Sub-Cards** | `FloorTables.tsx` | • Header strictly displays `"Floor Staff"` (removed subtitle and management label).<br>• Outer master card is static (`calc(100vh - 85px)`).<br>• Left sub-card (Orders for waiter/server) and right sub-card (table chart & selected table controls) scroll independently. |
| **Floor Staff Strict Table Seating (No Fulfillment Names)** | `WalkInOrderModal.tsx`<br>`CashierOrders.tsx` | • Removed takeaway and delivery options for floor staff.<br>• Removed all 3 names (`Dine-In`, `Takeaway`, `Delivery`) from floor staff modal and Orders Hub.<br>• Direct table seating selection without switcher buttons. |
| **Floor Staff Orders Hub** | `CashierOrders.tsx`<br>`StaffLayout.tsx`<br>`app/src/app/staff/page.tsx` | • Added 2nd sidebar item for Floor Staff: `"Orders Hub"` (`staff-floor-orders`) with active orders badge.<br>• Shows only dine-in orders concerned with floor staff.<br>• Search input placed in top right corner of the card (`marginLeft: 'auto'`). Main card static; only order cards scroll; items hidden until clicked into modal. |
| **Table Status Sync Across Database** | `api/tables/route.ts`<br>`AppContext.tsx` | • Supports all 4 statuses: `available`, `occupied`, `cleaning`, `reserved`.<br>• Syncs across PostgreSQL and broadcasts via `BroadcastChannel` to ensure identical table status across all screens. |
| **Walk-in Order Button Harmony & No Extra Plus** | `FloorTables.tsx`<br>`CashierOrders.tsx`<br>`CashierDesk.tsx` | • Removed redundant `+` from button text strings (`+ + Walk-in Order` -> `Walk-in Order`).<br>• Tuned `<Plus strokeWidth={2.4} color="#FFFFFF" />` to match bold 750 text weight, `#FFFFFF` color, `inline-flex` centered vertical alignment, and `lineHeight: 1` in exact same tune. |
| **Customer Menu Out of Stock Box Fix** | `CustomerMenu.tsx`<br>`MenuScreen.tsx`<br>`globals.css` | • Fixed duplicate text rendering inside the `.dish-order-btn` box.<br>• When `!isAvailable`, only renders a single `<span>Out of Stock</span>` (removes the duplicate desktop/mobile span pair and hides the plus icon entirely).<br>• Added universal `.dish-btn-text-desktop` / `.dish-btn-text-mobile` classes to `globals.css`. |
| **Floor Staff First Row Horizontal Card & Exact Dimension Match** | `FloorTables.tsx`<br>`CashierOrders.tsx` | • The first row is wrapped in a horizontal card (`Floor Staff` on left, `Live Table Grid`, `Reservations List (v1.1)`, and `Walk-in Order` on right) with dimensions, length, size, width, and vertical thickness (`height: 52px`, `minHeight: 52px`, `padding: 10px 16px`, `marginBottom: 10px`, `borderRadius: var(--radius-lg)`) **exactly matching** the first row card of Orders Hub.<br>• Decreased its vertical width/thickness to 52px with 15px bold title and 32px buttons so both screen headers match symmetrically.<br>• On scroll, this first row card is static (`flexShrink: 0`) and never moves. Below it, the sub-cards scroll independently only when data exceeds screen bounds. |
| **Complete Removal of 3 Fulfillment Options for Floor Member** | `CashierOrders.tsx`<br>`WalkInOrderModal.tsx`<br>`app/src/app/staff/page.tsx` | • When floor staff accesses Orders Hub (`staff-floor-orders`), the 3 category tabs (`Dine-In`, `Takeaway`, `Delivery`) are 100% removed because floor staff only proceeds with dine-in.<br>• Order cards and modal display table number (`Table #X`) with zero fulfillment labels.<br>• The first row card remains horizontal and static, while order cards below scroll only if list exceeds screen space. |
| **Branch Manager Header & Sidebar Cleanup** | `BranchManagerDashboard.tsx`<br>`StaffLayout.tsx` | • Removed `"Branch Manager Control Console"` title and subtitle `"Branch: Gulberg Branch (Flagship) · Daily Operations, Timing Windows, Menu Availability & Refunds"`.<br>• Removed `"🔒 Manager Mode: Changes allowed in top 2 options only. Operations are monitor & approvals only."` card from left sidebar. |
| **Dedicated Staff Accounts Screen in Left Sidebar** | `BranchStaffManagement.tsx`<br>`StaffLayout.tsx`<br>`app/src/app/staff/page.tsx` | • Moved staff account management completely out of the first left sidebar option (`staff-manager`) into a dedicated **Option 2: "Staff Accounts"** (`staff-manager-accounts`) with `Users` icon and subordinate count badge.<br>• Option 1 is renamed to **"Branch Operations"**, 100% focused on operational metrics, timing rules, busy mode, and payment configurations, with a quick card linking directly to Staff Accounts (`onNavigate?.('staff-manager-accounts')`). |
| **Strict Subordinate Scoping for Branch Manager** | `BranchStaffManagement.tsx`<br>`StaffLayout.tsx` | • Branch Manager can ONLY view and manage accounts for staff working **in their specific branch under them** (`cashier`, `kitchen_staff`, `floor_staff`, `branch_representative`, `delivery_staff`).<br>• Strictly filters out `platform_owner`, `customer`, `branch_manager` self, and personnel belonging to any other branch. Modal creations and edits only allow subordinate roles. |
| **Real Login Suspension & Session Revocation Enforcement** | `StaffAuth.tsx`<br>`StaffLayout.tsx`<br>`api/users/route.ts`<br>`AppContext.tsx` | • If the manager suspends an account, login is **strictly blocked** in `StaffAuth.tsx` with `"Account Suspended 🚫"` error toast and clear message.<br>• Suspended demo preset pills display a visible red **"Lock"** tag.<br>• Deleted staff accounts are blocked from login with `"Account Not Found ❌"`.<br>• Real-time session termination: If a subordinate is currently logged in on another terminal or browser tab, a live listener in `StaffLayout.tsx` immediately revokes their session via `BroadcastChannel`, notifies them, and forces them back to sign-in. |
| **Manager Profile Left Slide Options & Scrollable Views** | `StaffLayout.tsx`<br>`app/src/app/staff/page.tsx` | • Fixed bug where manager left slide options wouldn't open or cut off content due to static workspace layout lock.<br>• Replaced `overflowY: 'hidden'` with `overflowY: 'auto'` on `<main>` for Branch Manager views.<br>• Added explicit keys to screens to ensure proper remounting and responsive vertical scrolling when switching options. |
| **Platform Owner Overview Header & True DB Metrics** | `OwnerOverview.tsx` | • Removed `"Overview"` and `"Role: platform_owner · Central multi-branch visibility, cash health & anomaly alerts"` lines.<br>• Connected first 2 rows strictly to actual database values: actual paid orders today, real order counts today, active cash drawer totals, and live anomalies from database (pending refunds, shift variances, busy branches). |
| **Mutual Agreement Manager Mode Switch Workflow** | `OwnerOverview.tsx`<br>`BranchStaffManagement.tsx`<br>`AppContext.tsx`<br>`StaffLayout.tsx` | • Owner cannot switch to Manager mode unless both Owner and Manager agree.<br>• Owner sends access request per branch card (`requestManagerAccess`).<br>• Branch Manager reviews in "Branch Staff" (Staff Accounts) and accepts or declines (`respondManagerAccess`).<br>• Once approved, Owner is authorized to switch into Manager view, and can return to Owner Console via top header button (`👑 Return to Owner Console`). |
| **Branch Staff Isolation & Customer/Owner Exclusion** | `BranchesAndStaff.tsx`<br>`AppContext.tsx` | • Staff members are segmented and displayed strictly by their respective branch using interactive branch tabs (`All Branches`, `Gulberg Lahore`, `F-7 Islamabad`, `Clifton Karachi`).<br>• Excluded customer and platform owner accounts completely from staff views.<br>• Added the full Staff Creation UI matching Manager profile with system ID, role pickers, branch picker, mobile, email, and 4-digit PIN generation with Copy button.<br>• Added Edit Staff, Reset PIN, Suspend/Reactivate, and Delete modal confirmations. |
| **Manager Activity Audit Ledger** | `AuditLogView.tsx`<br>`api/audit-logs/route.ts` | • Enhanced Audit Log to focus on Manager Activity Actions (refund approvals, staff creations/suspensions, price changes, timing settings, busy mode toggling, owner delegation).<br>• Added PostgreSQL `/api/audit-logs` endpoint with persistence and live ledger refresh. |
| **Customer Orders Real Ledger & On-Demand Date Scopes** | `CustomersAndOrders.tsx`<br>`api/orders/route.ts` | • Replaced mixed customer registry with strictly Customer Orders view.<br>• Defaults to Today's data for ultra-fast performance.<br>• Supports on-demand historical queries (`Yesterday`, `Last 7 Days`, `This Month`, `Custom Range`, `All Time Archive`).<br>• Data card is scrollable (`overflowY: 'auto'`) with itemized order detail modal. |
| **Financial & Cash Reports Real Database Metrics** | `ReportsAndReconciliation.tsx` | • Replaced all hardcoded values with actual real calculations from database orders and cash shifts.<br>• Shows Today's data by default, fetching older records on-demand.<br>• Added real CSV export downloading verified order records. |
| **Staff Sidebar Header Line Alignment to Main Header** | `StaffLayout.tsx` | • Set sidebar header to `height: 60px`, `boxSizing: 'border-box'`, `padding: '0 16px'`, and `flexShrink: 0`.<br>• The bottom border line of the sidebar header (`FoodiesStaff OPERATIONS HUB`) aligns seamlessly with the 60px main staff top header (`Gulberg Branch`) across all screen sizes, forming a single unbroken horizontal line across the top of the web for all staff roles. |
| **Harmonized Checkout Popup Dimensions & Seamless Payment Transition** | `CustomerCheckout.tsx` | • Standardized the inner card container of the Payment step (`payment`) to the exact geometry, background, and height (`clamp(250px, 48vh, 310px)`) of the Order Option (`fulfillment`) and Details (`details`) steps.<br>• Completely eliminates sudden card size jumps when advancing from delivery details to payment options, keeping the modal card dimensions static, stable, and seamless.<br>• Added directional slide-and-fade CSS animations (`@keyframes checkoutSlideInRight` / `checkoutSlideInLeft`, `cubic-bezier(0.16, 1, 0.3, 1)`) for silky-smooth progression between steps.<br>• Added a refined 3-stage progress breadcrumb in the modal header (`1. Type` → `2. Details` → `3. Payment`) with animated checkmarks and primary accent states for visual continuity. |
| **WhatsApp Account Login with Verification Code** | `CustomerLoginModal.tsx`<br>`CustomerHeader.tsx`<br>`CustomerCheckout.tsx` | • Added WhatsApp login channel option (`#25D366`) allowing customers to sign in by receiving a 4-digit verification code directly through WhatsApp.<br>• Provides dual options: `[💬 Login through WhatsApp Code]` (Instant) and `[📱 Send Code via SMS]`.<br>• Triggers a realistic WhatsApp verification toast and transitions to a WhatsApp-themed verification view featuring a clear WhatsApp code banner, input field, 'Confirm WhatsApp Code & Sign In' action, and ability to switch between WhatsApp and SMS.<br>• Seamlessly integrated across Customer Sign In modal, Header profile login, and Checkout guest authentication. |
| **Store Maps & Nearest Branch Pop-Up Screen** | `StoreMapModal.tsx`<br>`CustomerHeader.tsx`<br>`BranchesAndStaff.tsx`<br>`api/branches/route.ts`<br>`database/schema.sql` | • Added interactive Store Maps pop-up screen modal triggered via the header 'Store Maps' button and sidebar 'Store Locator' drawer item.<br>• **Exact Proportional Layout**: **Left 1 quarter (28% width)** contains a scrollable list of branch names with their physical location address below the name in **less bold words** (`color: var(--text-muted)`), operational hours, and active/select branch buttons; **Right 3 quarters (72% width)** contains an interactive visual map showing the customer's current GPS location ("You Are Here" pulsing radar pin), active branch location pin, trajectory route line with travel distance pill, and floating branch summary card with direct Google Maps directions.<br>• **Live Geolocation & Nearest Detection**: Uses `navigator.geolocation.getCurrentPosition` and Haversine formula to compute exact distance in km to all branches, automatically highlighting the nearest branch with an emerald badge (`⚡ Nearest to you • X.X km`).<br>• **Strict Role-Based Location Editing**: Regular customers only view branches and select their store. Only **Platform Owner** and **Branch Manager** (`platform_owner` / `branch_manager`) are permitted to edit branch physical address, city, phone, and latitude/longitude coordinates with PostgreSQL database persistence (`PATCH /api/branches`). |
| **Compact Branch Locator, Directional Lines, Checkout Route Step & Profile Location Editing** | `StoreMapModal.tsx`<br>`CustomerCheckout.tsx`<br>`CustomerHeader.tsx`<br>`StaffLayout.tsx` | • **Compact Checkout-Proportioned Sizing**: Redesigned the branch locator pop-up screen (`StoreMapModal.tsx`) into a compact modal (`width: clamp(320px, 94vw, 700px)`, `height: clamp(420px, 68vh, 520px)`, `borderRadius: 24px`) matching the checkout modal styling.<br>• **Directional Route Lines**: Added animated directional trajectory lines on the map:<br>&nbsp;&nbsp;- If **Delivery**: The direction line and arrowhead point **from branch TO you** (`Branch ➔ You`).<br>&nbsp;&nbsp;- If **Takeaway / Dine-In**: The direction line and arrowhead point **from you TO branch** (`You ➔ Branch`).<br>• **Pre-Payment Checkout Step**: Integrated the store locator and directional route map directly into checkout as Stage 2.5 (`'branch_map'`) between fulfillment details and payment options. Header breadcrumb updated to 4 stages (`1. Type` → `2. Details` → `3. Branch` → `4. Payment`), preserving the uniform `height: clamp(250px, 48vh, 310px)` card geometry with zero layout shifts.<br>• **Manager & Owner Profile Location Editing**: Directly added the branch location edit action into Manager and Owner profiles:<br>&nbsp;&nbsp;- In **Customer Profile Modal** (`CustomerHeader.tsx`): Displays a dedicated "Branch Location Access" card with `[Edit Location 📍]` button for `branch_manager` and `platform_owner`.<br>&nbsp;&nbsp;- In **Staff Top Header & Staff Profile Modal** (`StaffLayout.tsx`): Top bar features an immediate `[Edit Branch Location 📍]` quick-action button, and clicking the user profile badge/name opens the Staff Profile Modal with direct branch GPS, address, city, phone, and name editing via `StoreMapModal`. |
| **WhatsApp-Only Verification & 30s Resend Cooldown** | `CustomerLoginModal.tsx`<br>`CustomerHeader.tsx`<br>`CustomerCheckout.tsx` | • **SMS Channel Removed**: Completely removed SMS options and buttons across all customer login modals and checkout guest auth. WhatsApp is now the sole verification channel (`#25D366`).<br>• **30-Second Cooldown**: Generating a WhatsApp code enforces an exact 30-second countdown cooldown (`authResendCountdown` / `checkoutResendCountdown`). The user cannot request another OTP until the 30s expires. Clicking "Resend WhatsApp Code" generates a new code and resets the 30s timer. |
| **Phone-Based Customer Profile & Strict Order Isolation** | `CustomerLoginModal.tsx`<br>`CustomerHeader.tsx`<br>`CustomerCheckout.tsx`<br>`CustomerHistory.tsx`<br>`CustomerTracking.tsx`<br>`CustomerSupport.tsx` | • **Profile by Mobile Number**: When a user logs in, their profile is recalled and saved strictly based on the Pakistani mobile number entered (`normalizePhone = (p) => p.replace(/\D/g, '').slice(-10)`) via `foodies_customer_registry`. Typing a 10-digit number auto-populates their saved profile name.<br>• **Zero Name Matching & Zero All-Orders Fallback**: Customer Order History (`CustomerHistory.tsx`), Tracking (`CustomerTracking.tsx`), and Support Tickets (`CustomerSupport.tsx`) strictly filter orders and complaints by normalized phone number or customer ID. Never matches by customer name, and never falls back to showing all cafe orders. When no orders match, displays an empty state with direct button to browse menu. |
| **Nearest Branch Auto-Lock with Manual Selection Override** | `AppContext.tsx`<br>`StoreMapModal.tsx`<br>`CustomerHeader.tsx`<br>`CustomerCheckout.tsx` | • **Automatic Nearest Lock**: On startup, geolocation computes distances to all branches and automatically locks the user to the nearest branch if no manual branch was selected.<br>• **Manual Override Respected**: When a customer explicitly selects any branch in Store Locator or Checkout, choice is persisted to `foodies_customer_manual_branch` and preserved. |
| **Admin Panel & Customer Web Refresh Persistence** | `app/src/app/page.tsx`<br>`app/src/app/staff/page.tsx`<br>`StaffLayout.tsx` | • **Staff Admin Panel**: Refreshing `/staff` restores active view from `foodies_staff_view`, preserving authenticated role, tab, and loaded data without resetting to login.<br>• **Customer Web**: On browser refresh, customer web always resets view to `'home'`, while selected cart items remain persisted in `foodies_cart`. |
| **Harmonized Store Locator Map & Checkout Design** | `StoreMapModal.tsx`<br>`CustomerCheckout.tsx` | • **Exact Vector Map Harmonization**: In `StoreMapModal.tsx`, replaced map with exact clean SVG styling from checkout (`#F7F6F1` background, `#ckGrid` 24x24 pattern, background road veins, radar animated customer pin, coffee branch pins, animated route trajectory).<br>• **Cleaned Elements**: Removed subtitle `🛵 Delivery: Route flows from Branch to You`, removed `Delivery` and `Pickup / Dine` toggle buttons, and removed overlay pills. |
| **Automated Email Dispatch via Account Mailer (Zero-Key Customer Experience)** | `CustomerLoginModal.tsx`<br>`CustomerCheckout.tsx`<br>`StaffLayout.tsx`<br>`api/auth/email/route.ts`<br>`.env`<br>`app/.env` | • **Zero Keys for Customers**: Customers only input their email (and optional name). The system automatically dispatches verification codes to the customer's email. No keys, setup buttons, or technical configurations are ever shown to customers.<br>• **Direct Cafe Account Dispatch (Sends to Everyone)**: Dispatches verification codes using the cafe's central mail account (e.g. Gmail/Google Workspace with 16-character Google App Password) via `nodemailer` with zero domain restrictions.<br>• **Protected Staff Admin Management**: Platform Owner and Branch Manager can configure, test, and activate the cafe's sender email directly from their Staff Profile (`StaffLayout.tsx`) via `action: 'save_server_config'` without editing files manually.<br>• **Zero-Restart Persistence**: Credentials persist dynamically to `.env` and `mail_config.json`, instantly activating automated delivery for all customers across all browsers. |
| **Delivery Rider Console, Real-time Customer GPS, Google Maps Directions & Manager Controlling** | `RiderDashboard.tsx`<br>`CustomerCheckout.tsx`<br>`RepresentativeInbox.tsx`<br>`BranchManagerDashboard.tsx`<br>`StaffAuth.tsx`<br>`StaffLayout.tsx`<br>`AppContext.tsx`<br>`cafe.ts` | • **Automatic Customer GPS Location Storage**: When a customer places a delivery order and allows geolocation access, their precise latitude and longitude (`customerCoordinates: { lat, lng }`) are automatically attached to the order and stored.<br>• **Dedicated Delivery Rider Staff Option**: Added `delivery_staff` role preset in Staff Auth (`rider1.gulberg@foodiescafe.pk`) and dedicated navigation (`Rider Console` and `Delivery History`).<br>• **Rider Order Dashboard with Filters**: Shows active assigned deliveries with tabs to filter: `All`, `Cash on Delivery (COD)`, `Paid`, and `Delivered`.<br>• **Bottom Right Corner "Get Direction"**: Prominently located in the bottom right corner of each delivery card (`Get Direction 🗺️`), clicking opens exact turn-by-turn navigation in Google Maps (`https://www.google.com/maps/dir/?api=1&destination=...`) using the customer's stored GPS coordinates or delivery address.<br>• **Order Menu Pop-up Modal**: Clicking any order card opens an itemized pop-up modal displaying all dishes, item quantities, customizations, subtotal, special notes, and customer contact details.<br>• **Finished Delivery Action**: When the delivery is completed, the rider clicks `Finish / Delivered` (with COD collection confirmation), instantly marking the order delivered and freeing the rider for new assignments.<br>• **Order History of Previous Days**: Dedicated history view with metrics (Deliveries Completed, Total Value Delivered, Cash Collected) and date scopes (`Today`, `Yesterday`, `Past 7 Days`, `All Past Days`) and keyword search.<br>• **Customer Support Fleet Assignment**: Customer Support (`RepresentativeInbox.tsx`) has a live fleet status overview bar and direct rider assignment dropdown (`+ Assign Rider`) on delivery orders.<br>• **Branch Manager Controlling Hub**: Branch Manager (`BranchManagerDashboard.tsx`) has a dedicated "Rider Fleet & Delivery Operations Hub" to control riders, monitor active orders, toggle rider duty availability (`Available` vs `Shift Offline`), and reassign orders. |
| **Rider & Manager Login Credentials Display & One-Click Testing** | `StaffAuth.tsx`<br>`BranchManagerDashboard.tsx`<br>`BranchStaffManagement.tsx` | • **Login Screen Credentials Box**: Added dedicated credentials helper directly in `StaffAuth.tsx` showing the selected staff member's Name, Login Email/ID, and Password (`password123`).<br>• **Fast 1-Click Buttons**: Added `[🛵 Rider Credentials]` and `[🏢 Manager Credentials]` shortcut buttons directly on the sign-in form to auto-fill credentials instantly.<br>• **Manager Console Direct Use**: Inside Manager Dashboard (`BranchManagerDashboard.tsx`), each rider card displays login credentials (`password123` / PIN `1234`) and features a `[🛵 Use Rider Account]` action to switch into the Rider Console immediately. |
| **Gulberg Branch Manager Login Alignment, Account Password Creation & Editing, Staff Login Cleanup** | `StaffAuth.tsx`<br>`BranchStaffManagement.tsx`<br>`BranchesAndStaff.tsx`<br>`AppContext.tsx`<br>`api/users/route.ts`<br>`cafe.ts` | • **Branch Alignment on Login**: Automatically synchronizes `currentBranchId` and `currentBranch` to `matchedUser.branchId` upon staff login, completely resolving the bug where Gulberg Branch Manager logged into another branch with empty subordinate staff data.<br>• **Robust Manager Credentials**: Supports logging in with code (`user-bm`, `bm-gulberg`, `manager.gulberg`, `manager.gulberg@foodiescafe.pk`, `03002223344`), auto-matching Gulberg Branch Manager Rashid Mehmood and displaying all 6+ branch staff immediately.<br>• **Create Password Option for Staff Accounts**: In both Branch Manager (`BranchStaffManagement.tsx`) and Platform Owner (`BranchesAndStaff.tsx`), staff creation modals now feature an explicit "Create Password *" input field with Lock icon alongside Default Access PIN, saving directly to PostgreSQL `password_hash`.<br>• **Full Edit Options for Owner & Manager**: Both Owner and Manager staff edit modals support editing Full Name, Role, Phone, Email, Branch (for Owner), and "Edit Password / Login Access *" with Lock icon, syncing to state, localStorage, and PostgreSQL `/api/users`.<br>• **Staff Login Cleanup**: Removed the Rider delivery card / `Rider Credentials` button from the staff login page, removed `delivery_staff` from login presets, and removed the `[← Return to Customer Storefront]` link completely. |
| **CSR Rider Assignment Persistence & Rider Online/Offline Duty Functionality** | `RepresentativeInbox.tsx`<br>`RiderDashboard.tsx`<br>`AppContext.tsx`<br>`api/orders/route.ts`<br>`api/users/route.ts`<br>`schema.sql`<br>`seed.sql` | • **Fixed 1–2 Second CSR Rider Assignment Reset**: Root-caused bug where selecting a rider in Customer Service (`RepresentativeInbox.tsx`) reset back to "no rider selected" after 1-2 seconds. The 2.5-second polling routine in `AppContext.tsx` was fetching from `/api/orders`, which omitted `assigned_rider_id`, `assigned_rider_name`, and `rider_status` from the database query, overwriting local state with null values. Fixed by adding full schema columns, auto-migrations, and destructuring in `GET`, `POST`, and `PATCH /api/orders`, and persisting assignments immediately in `assignRiderToOrder`.<br>• **Controlled CSR Dropdown with Unassign Option**: Converted the CSR rider selector to a controlled `<select value={ord.assignedRiderId || ''}>` with dynamic rider options and an explicit `Unassign Rider` option, maintaining the selected rider persistently without resetting on database polling.<br>• **Fixed Rider Online/Offline Selection & Duty Controls**: Resolved the issue where the rider online/offline button was not working in `RiderDashboard.tsx`. Added `rider_availability`, `rider_total_deliveries`, and `rider_active_order_id` columns to `users` schema, auto-migrations, and `GET/PATCH /api/users`.<br>• **Explicit Duty Segmented Selector**: Implemented an explicit segmented duty selector in the Rider Console with clear **`🟢 Online (Ready)`** and **`⚫ Offline (Off Duty)`** buttons, plus a dynamic quick-toggle action button (`Go Online Now` / `Go Offline`), immediate visual feedback, local state synchronization, and background PostgreSQL database persistence. |
| **Staff Login Clean Redesign: Removed Credentials Card & Restored Rider Profile Option** | `StaffAuth.tsx` | • **Removed Account Credentials Card Fully**: Completely removed the popup/display card that showed `Account Credentials`, `✓ Auto-Filled`, `Staff Name`, `Password`, `Login Email / ID`, and the `🏢 Gulberg Manager Credentials (Auto-Fill)` button when clicking on a staff profile.<br>• **Clean Staff Profile Options with Rider**: Staff login now features exclusively the staff profile selection pills displaying all roles including **Rider** (`delivery_staff`, `Bike` icon) alongside Manager, Kitchen, Cashier, Floor, Customer Services, and Owner.<br>• **Direct Fast Sign-In**: Clicking any staff profile immediately populates the email and password inputs directly into the sign-in form without displaying any extra cards or clutter. |
| **Serverless Resilient Email OTP Verification & Login Number Row Removal** | `api/auth/email/route.ts`<br>`CustomerCheckout.tsx`<br>`CustomerLoginModal.tsx` | • **Root-Caused Serverless "Invalid Credentials" Error**: In serverless production deployments (Vercel lambdas), the temporary in-memory OTP map was isolated across different lambda execution instances. When `action: 'verify'` ran, a new container had an empty map, rejecting valid OTPs.<br>• **Multi-Layered Cryptographic Signed Token + DB Solution**: Implemented stateless HMAC-SHA256 signed tokens (`emailToken: expiresAt.hmac`) generated during `send` and validated during `verify`, coupled with automatic PostgreSQL persistence in table `email_otps` and in-memory fallback. Guarantees 100% verification reliability across any serverless or multi-container environment.<br>• **Removed Phone Number Row from Login**: In `CustomerCheckout.tsx`, removed the `Contact Mobile Number (🇵🇰 +92)` input row from the guest authentication form, aligning it symmetrically with `CustomerLoginModal.tsx` (only Full Name and Email Address). |
| **Zero-Loop Customer Auth State, Lazy LocalStorage Initialization & Instant Checkout Advancement** | `AppContext.tsx`<br>`CustomerCheckout.tsx`<br>`CustomerLoginModal.tsx`<br>`CustomerHeader.tsx`<br>`app/page.tsx` | • **Lazy Synchronous State Initialization**: In `AppContext.tsx`, initialized `currentUser` with a lazy state callback reading `localStorage.getItem('foodies_customer_user')`, ensuring `currentUser` is already the authenticated user on the very first render and never defaults to `GUEST_CUSTOMER` upon refresh.<br>• **Active Auth Synchronization**: Added a persistent `useEffect` in `AppContext.tsx` keeping `foodies_customer_user` in sync with `currentUser` across all sessions.<br>• **Dual-Layer `isUserLoggedIn` Check**: In `CustomerCheckout.tsx`, `CustomerHeader.tsx`, and `page.tsx`, updated the auth predicate to check both React state `currentUser` and `localStorage` fallback directly, preventing any render lag or race conditions from dropping authentication state.<br>• **Checkout Step Auto-Advance**: In `CustomerCheckout.tsx`, added an automatic step advance effect (`if (checkoutStep === 'auth' && isUserLoggedIn) setCheckoutStep('fulfillment')`). Upon OTP verification, `authOtpStep` resets to `'email'`, `authOtpCode` clears, and `checkoutStep` sets directly to `'fulfillment'`, completely eliminating any repeated login prompts. |
| **Customizable Branch Order Distance & Universal Pop-up Header Cleanup (1–2 Word Intros)** | `CustomerCheckout.tsx`<br>`StoreMapModal.tsx`<br>`BranchManagerDashboard.tsx`<br>`BranchesAndStaff.tsx`<br>`CustomerLoginModal.tsx`<br>`CustomerFloorSeatingModal.tsx`<br>`CustomerHeader.tsx`<br>`WalkInOrderModal.tsx`<br>`BranchStaffManagement.tsx`<br>`StaffLayout.tsx`<br>`CustomersAndOrders.tsx`<br>`CashierDesk.tsx`<br>`RepresentativeInbox.tsx`<br>`RiderDashboard.tsx`<br>`KitchenQueue.tsx`<br>`CashierOrders.tsx`<br>`CustomerSupport.tsx`<br>`ModalConfirmation.tsx`<br>`CartCheckoutModal.tsx`<br>`MenuAndPrices.tsx`<br>`api/branches/route.ts`<br>`schema.sql`<br>`seed.sql`<br>`types/cafe.ts` | • **Customizable Order Acceptance Distance per Branch**: Added `max_order_distance_km` (default 50 km) to PostgreSQL `branches` table, `/api/branches`, and `Branch` TypeScript interface.<br>• **Manager & Owner Configuration**: Branch Managers can set the maximum order acceptance radius directly in their operational settings (`BranchManagerDashboard.tsx`), while Owners and Managers can also adjust it in the "Edit Branch Location" modals (`StoreMapModal.tsx` and `BranchesAndStaff.tsx`).<br>• **Universal Order Distance Enforcement**: Validates customer coordinates against branch delivery radius during checkout and store locator selection, displaying clear guidance if the customer is outside delivery range.<br>• **Universal Pop-up Header Cleanup**: Replaced verbose paragraph introductions across all system modal headers with clean, professional 1–2 word subtitles (e.g. `Instant Verification`, `Branch Operations`, `Floor Layout`, `Direct Dispatch`). |
| **Notification Screen Layout Reorder & Header Cleanup** | `CustomerProfile.tsx`<br>`CustomerHeader.tsx` | • **Notifications Placed at Top**: Reordered the Notification tab in Customer Profile so that the live **Notifications** list is displayed first at the top, followed by **Notification Settings** directly below it.<br>• **Streamlined Tab Headers**: Cleaned up notification headers and description text to maintain a crisp, minimalist interface. |
| **Mobile Left Slide Drawer for All Staff in Web** | `StaffLayout.tsx`<br>`globals.css` | • **Customer-Style Mobile Drawer for All Staff**: On mobile and small screens (`<= 768px`), the static sidebar is hidden (`display: none`), freeing 100% of the screen width for staff operations.<br>• **3 Horizontal Lines (Hamburger Menu) Button**: On mobile viewports, the staff top bar prominently displays a 3 horizontal lines button (`<Menu size={20} strokeWidth={2.4} />`, 38x38px, matching the customer header hamburger).<br>• **Left Slide-Out Drawer Panel & Backdrop**: Clicking the 3 horizontal lines button opens a smooth left slide-out drawer (`transform: translateX(0)`, `300px` width) with a backdrop overlay (`rgba(15, 12, 10, 0.55)` and `blur(4px)`).<br>• **Slide-Out Details & Role Isolation**: Features the staff avatar, full name, role badge, branch name, and close `X` button, followed by all role navigation options with active highlighting, live order counters, and manager action alerts.<br>• **Fast Auto-Close**: Clicking any navigation item navigates to that screen and immediately closes the slide; clicking the backdrop or pressing the Escape key closes the drawer; Staff Sign Out action is available at the bottom of the drawer. |
| **Branch Manager Console Cleanup, Working Wallet Payment Toggle & Compact Action Badge (`x`)** | `BranchManagerDashboard.tsx`<br>`CustomerCheckout.tsx`<br>`StaffLayout.tsx`<br>`AppContext.tsx`<br>`api/branches/route.ts` | • **Fast Mode Banner Removed**: Removed `⚡ Fast Mode: Today Only`, description text, and `📂 Fetch Older Data ⬇` button from the first Branch Manager option (`Branch Operations`).<br>• **Rider Operations Isolation**: Completely removed the "Rider Fleet & Delivery Operations Hub" card and all rider consoles/duty controls from the manager screen, keeping rider duty and order dispatch strictly within the dedicated Rider Operations tab (`staff-rider`).<br>• **Cleaned Payment & Menu Headers**: Cleaned the payment card header to strictly `"Branch Payment Modes"` (removed `" & Installment Rules"` and the explanatory subtitle paragraph). Removed the subtitle `"Managers can toggle availability for this branch only (owner controls master prices)."` under Branch Menu Availability Toggles.<br>• **Working Branch Wallet Payment Enforcement**: Added PostgreSQL database persistence (`payment_settings` JSONB) via `PATCH /api/branches` in `AppContext.tsx`. In `CustomerCheckout.tsx`, branch payment settings are enforced for each order type (`dine_in`, `takeaway`, `delivery`). When a manager disables Mobile Wallet, the customer site marks Wallet as disabled (`Disabled by Branch Manager`, `OFF` badge, disabled styling), auto-switches the customer to an available payment mode, and strictly blocks order submission with an error toast if attempted.<br>• **Compact Manager Left Slide Action Badge (`x`)**: Replaced all verbose `Action Req (x)` and `Approval Req (x)` badges in the manager's left slide navigation options with strictly the clean action count number `x` (e.g. `1`), styled in a clean pill badge in both mobile drawer and desktop sidebar. |
| **Cashier Table QR Generation, Reserved Bypass Toggle, Mobile No-OTP Checkout & Live Dining Card** | `CashierDesk.tsx`<br>`TableQrModal.tsx`<br>`TableQrCodeSvg.tsx`<br>`CustomerTableQR.tsx`<br>`CustomerHeader.tsx`<br>`KitchenQueue.tsx`<br>`AppContext.tsx`<br>`api/tables/route.ts`<br>`api/orders/route.ts`<br>`types/cafe.ts`<br>`database/schema.sql` | • **Cashier Table QR Generator (`TableQrModal.tsx`)**: Added `[Table QR Codes]` button with `QrCode` icon next to Walk-in Order on Cashier Desk. Cashiers can select any table, generate a special QR code with a chosen time duration (30 mins, 1h, 2h, 4h, 8h shift), copy the direct scan link, simulate/open the scan view immediately, and print physical tent cards (`🖨️ Print Table QR Tent Card`).<br>• **Cashier Reserved Bypass Permission Toggle**: Added a dedicated switch: **"Allow Ordering on Already Reserved Tables"**. When enabled, a customer scanning the physical table QR in-store will see a reserved notice with an active **"Ignore & Continue Ordering 🍽️"** button to bypass online reservation and proceed with in-store dining. When disabled, the reservation is strictly enforced.<br>• **Customer Table QR Landing & Reserved Pop-up (`CustomerTableQR.tsx`)**: Automatically parses table from URL (`?tableQr=T-01` or `?table=T-01`). If table is available, immediately checks in and opens the Dine-In menu. If reserved, pops up the **"Table Reserved"** card. If cashier enabled bypass, customer can click `Ignore & Continue Ordering 🍽️` to claim the table for physical dining.<br>• **Dine-In Exclusive Menu & 2-Step Mobile Checkout (Zero OTP)**: Shows order menu strictly for Dine-In (Table #X). On mobile/small screens, clicking View Table Order opens a 2-step checkout: **Step 1 (Selected items pop-up card)** reviews dish quantities, prices, 16% GST, and total; **Step 2 (Forward click)** asks for Pakistani contact phone number (optional name/notes) with **ZERO OTP confirmation required**, instantly forwarding the order to the kitchen.<br>• **Live Temporary Dining Card & 5-Minute Cancel Window**: While dining at the table, customer screen renders a live Temporary Dining Card with order status (`Sent to Kitchen ⏱️` → `Preparing 👨‍🍳` → `Ready 🍽️` → `Served ✓`), assigned waiter, itemized dishes, and total bill. Includes a live **5-minute cancel countdown timer** with `[Cancel Order ❌]`. After or during dining, customer can click **`[+ Add Extra Items to Table Bill 🍽️]`** to re-order and append drinks, desserts, or dishes to their existing active bill.<br>• **Floor Waiter Assignment & Kitchen Ready Notification**: Automatically assigns the table order to the floor staff/waiter of that branch/floor (`assignedWaiterId`, `assignedWaiterName`). Visible in live orders across Cashier, CSR Support, Manager, and Owner. In `KitchenQueue.tsx`, when an order is marked ready or served, the kitchen screen triggers a high-visibility notification alerting the assigned waiter by name (`"Order #FC-XXXX for Table T-01 is READY! Dispatched to Waiter [Name] 🍽️"`). |
| **Cashier Dine-In Isolation, Walk-in Default, Auto/Manual Table Release & Table QR Pay-After-Eating** | `CashierOrders.tsx`<br>`CashierDesk.tsx`<br>`WalkInOrderModal.tsx`<br>`CustomerTableQR.tsx`<br>`StaffLayout.tsx`<br>`AppContext.tsx` | • **Cashier Order Hub Category Removal**: Completely removed the 3 order category buttons (`Dine-In Orders`, `Takeaway Orders`, `Delivery Order`) from the Cashier Orders Hub (`CashierOrders.tsx`). The cashier order hub and cashier profile strictly show and accept Dine-In orders placed via walk-in counter customers or table QR code scans (`type === 'dine_in'` and `isWalkIn` or `isTableQr` or `tableQrSessionId`). Takeaway and delivery orders are filtered out to their respective staff consoles.<br>• **Walk-In Order Locked Strictly to Dine-In**: In both Cashier Desk (`CashierDesk.tsx`) and Walk-in Order Modal (`WalkInOrderModal.tsx`), removed all order type selection toggles (`dine_in`, `takeaway`, `delivery`) and delivery address fields. Walk-in orders default strictly and exclusively to Dine-In with direct table selection for seating.<br>• **Manual & Automatic Table Release ("Mark Table Free")**: Added a dedicated `[Mark Table Free 🪑]` action directly in Cashier Desk and Cashier Orders. When the cashier proceeds/records a cash payment after the customer eats/leaves, the table is automatically marked `available` (`status: 'available'`, `currentOrderId: undefined`, `reservedFor: undefined`) in state, active table session is cleared, and updates are synchronized to PostgreSQL `/api/tables` and broadcast across all staff and customer devices.<br>• **Table QR "Pay After Eating & Free Table" Checkout**: On the customer's live temporary dining card (`CustomerTableQR.tsx`), added a prominent **`[Pay After Eating & Free Table 💳]`** checkout button. Customers can select Cash (to waiter/cashier), Credit/Debit Card, or Mobile Wallet. Upon confirming payment, the bill is settled, the table is automatically released as `available` for new customers, the table session is cleared, and a celebration card is displayed with an option to browse the storefront.<br>• **Mobile 2-Step Fast QR Checkout (Zero OTP)**: Fully preserves the fast mobile flow: Step 1 displays the selected items pop-up card, Step 2 prompts for phone number with zero OTP confirmation, immediately forwarding the order to the kitchen. |
| **Staff Session Persistence, Storage Isolation & Permanent Resolution of Customer/Kitchen Demotion** | `AppContext.tsx`<br>`StaffLayout.tsx`<br>`StaffAuth.tsx`<br>`app/staff/page.tsx`<br>`OwnerOverview.tsx`<br>`app/page.tsx` | • **Root-Cause Analysis**: Previously, staff authentication did not have dedicated storage keys and shared `foodies_customer_user`. When remaining active or upon tab reload/refresh, `currentRole` in `AppContext` reset to its initial state `'customer'`. Consequently, `StaffLayout` rendered with role `'customer'`, its nav fallback triggered `staff-kitchen` ("Operations Dashboard / Kitchen Queue"), and the subordinate revocation effect erroneously flagged the session.<br>• **Dedicated Staff Storage Keys (`foodies_staff_user` & `foodies_staff_role`)**: Isolated staff authentication into persistent dedicated keys (`foodies_staff_user` and `foodies_staff_role`). Staff accounts are never saved to or overwritten by `foodies_customer_user`.<br>• **Live Database User Session Re-synchronization**: Every 2.5 seconds when `fetchDatabaseData` polls `/api/users`, active staff sessions are validated against live database records, keeping the staff user's name, role, and branch fresh in state and localStorage so sessions remain active indefinitely without degrading.<br>• **Robust `effectiveRole` Resolution & Kitchen Fallback Fix**: In `StaffLayout.tsx`, defined `effectiveRole` prioritizing active role, user role, and persistent staff role before falling back. Owner and Manager navigation items and role badges remain locked to their master roles and will never display `CUSTOMER` or default to the Kitchen screen.<br>• **Master Role Protection in Session Revocation**: In `StaffLayout.tsx`, added guards preventing session revocation from running on Platform Owner or Branch Manager accounts, or on customer sessions.<br>• **Clean Staff Sign-Out**: Properly clears `foodies_staff_user`, `foodies_staff_role`, and `foodies_staff_view` on sign out in both desktop sidebar and mobile drawer. |
| **Customer Table QR In-Store Geolocation Verification, Customized Distance Enforcement & Ordering Lock** | `CustomerTableQR.tsx`<br>`types/cafe.ts`<br>`api/branches/route.ts`<br>`schema.sql`<br>`seed.sql`<br>`AppContext.tsx`<br>`BranchManagerDashboard.tsx`<br>`StoreMapModal.tsx`<br>`BranchesAndStaff.tsx` | • **Automatic In-Store Location Request (`navigator.geolocation`)**: When a customer scans a table QR code (or opens `?tableQr=...` or `?table=...`), the application automatically checks device location permissions and prompts the customer to grant GPS location access.<br>• **Branch-Customized Distance Radius (`tableQrMaxDistanceMeters`)**: Added `table_qr_max_distance_meters INT NOT NULL DEFAULT 300` in PostgreSQL database `branches` table, `/api/branches` API (GET & PATCH), and `Branch` TypeScript model. Branch Managers can customize their branch's table ordering radius (e.g. 100m, 300m, 500m) directly under Operational & Timing Settings (`BranchManagerDashboard.tsx`), while Platform Owners and Managers can also adjust it anytime in the Branch Edit modals (`StoreMapModal.tsx` and `BranchesAndStaff.tsx`).<br>• **Haversine Distance Verification & Location Badges**: Implemented the Haversine formula calculating exact distance in meters between customer GPS and branch coordinates. When verified within the allowed distance, displays a sleek green status pill: `🟢 Location Verified: Seated at [Branch Name] ([X]m away) · Radius Limit: [Y]m`.<br>• **Strict Ordering Blockade Outside Radius**: If the customer's distance exceeds the customized radius (or location access is denied), **they cannot order** from that table QR. All ordering actions are strictly blocked: `handleStartOrdering`, `handleIgnoreReservationAndContinue`, `handleAddToCart`, and `handleSubmitTableOrder` trigger alert toasts and pop up the location dialog. Dish cards display a locked button (`🔒 Verify & Add`), and the floating checkout bar is locked with `🔒 Verify Location to Checkout`.<br>• **Interactive Guidance & Fallback for Remote Users**: Prominently renders a high-visibility alert banner and modal: `"🚫 Outside Cafe Dining Zone — Table Ordering Locked (You are Xm away, Max allowed: Ym)"`, with friendly one-click actions: `[Re-check My Location 📍]` to refresh GPS, or `[Order Delivery / Takeaway Instead 🛵]` to switch directly to home delivery. |
| **Standards-Compliant Scannable Table QR Code Generator (Google Scanner / Lens Fix)** | `TableQrCodeSvg.tsx`<br>`TableQrModal.tsx`<br>`CustomerTableQR.tsx`<br>`app/src/app/page.tsx`<br>`AppContext.tsx`<br>`package.json` | • **Root-Cause Analysis**: Previously, `TableQrCodeSvg.tsx` generated mock pseudo-random boolean grids with FNV-1a hashing (`pseudoRand(counter) > 0.46`) rather than standard ISO/IEC 18004 Reed-Solomon QR codewords. Google Scanner / Lens and native camera scanners could not recognize the image as a barcode or decode it.<br>• **Standard ISO/IEC 18004 Engine with Level H Error Correction**: Switched to authentic `qrcode` matrix generation with Level H redundancy (30% error correction) and a 3-module quiet zone margin, guaranteed to scan instantaneously across Google Scanner, Google Lens, iOS Camera, and all handheld barcode readers.<br>• **Branding Badge & Toggle**: Center Foodies logo badge is sized within ~18% of the QR matrix with a protective white plate, safely within Level H 30% redundancy. Added a dynamic toggle: `Brand Badge: [ON ✓ / OFF]` on Cashier Desk.<br>• **Offline High-Res Tent Card Printing**: Replaced external `api.qrserver.com` dependency with direct base64 `QRCode.toDataURL` generation inside `handlePrintTentCard`, printing instant, razor-sharp 400x400 tent cards offline with zero network latency or rate-limiting.<br>• **PNG Download & Domain Configuration**: Added `[Save PNG 💾]` to download 600x600 high-resolution table QR images. Added an in-modal base domain editor (`[Set Domain]`) with persistent local storage so cashiers or developers can set custom deployment URLs or reset to detected host.<br>• **Instant Customer QR Route & Branch Synchronization**: Customer main page initializes `currentView` directly to `'table-qr'` if `tableQr` or `table` URL param is present (preventing home page flash), and `CustomerTableQR` synchronizes `currentBranchId` directly from the `branch` URL query parameter. |
| **Small Screen Customer Web Polish, Unified Pop-up Drawer & 2-Item Scrollable Checkout** | `MarketingHome.tsx`<br>`CustomerMenu.tsx`<br>`CustomerCheckout.tsx`<br>`CustomerLoginModal.tsx`<br>`CustomerFloorSeatingModal.tsx`<br>`StoreMapModal.tsx`<br>`ItemDetailModal.tsx`<br>`ModalConfirmation.tsx`<br>`globals.css`<br>`highlight.md` | • **Home Screen Clean Hero**: Removed `"View Full Menu"` button on small screens (`<= 768px`) using `.home-view-full-menu-btn`.<br>• **Customer Menu Item Cleanup**: On small screens (`<= 860px`), items strictly display only item photo and item name. Removed Description / Recipe Details, Category badge, and `Price (Cash)` label. Displays `Rs. {displayPrice}` and `+ Order` in the exact same row.<br>• **Isolated Click Feedback**: Removed card-level `onClick` and card active scale animations. Clicking the card does not react; clicking the `+ Order` sign or stepper triggers active press feedback (`scale(0.92)`) exclusively on that specific order box.<br>• **Universal Mobile Bottom-Drawer Modal Design**: On mobile (`<= 768px`), all pop-up screens (`CustomerCheckout`, `CustomerLoginModal`, `CustomerFloorSeatingModal`, `StoreMapModal`, `ItemDetailModal`, `ModalConfirmation`) adopt the Table QR scanner checkout bottom-drawer design (`align-items: flex-end`, sliding up from bottom with `border-top-left-radius: 24px`, `border-top-right-radius: 24px`, and `animation: slideUpDrawer 0.25s cubic-bezier(0.16, 1, 0.3, 1)`).<br>• **Compact 2-Item Scrollable Checkout**: In checkout step `order_review`, selected items are capped at `maxHeight: '112px'` with `overflowY: cart.length > 2 ? 'auto' : 'hidden'`, displaying exactly 2 items at a time and scrolling vertically if 3+ items are present. Outer card container is compact (`maxHeight: '235px'`, `height: 'auto'`), strictly preventing oversized cards.<br>• **Preserved Branch Locator**: Preserved the branch locator card layout, split store list (~28%), directional route lines, and 100% of its existing text and content without alteration. |
| **Branch Manager Console Polish, Phone Dropdown & Refund Queue Reorganization** | `BranchManagerDashboard.tsx`<br>`globals.css`<br>`highlight.md` | • **Phone Dropdown for 4 Order Types**: In the first option of the manager profile (`Branch Operations`), the 4 options (`⚡ Apply to All Order Types`, `Dine-In`, `Takeaway`, `Delivery`) are converted into a single responsive `<select>` dropdown (`.bm-payment-tabs-mobile`) when viewed on phone screens (`<= 640px`), while preserving desktop button/tabs (`> 640px`).<br>• **Removed Distance Descriptions**: Removed the 2 explanatory subtitle paragraphs under `Max Order Acceptance Distance (km)` and `Table QR Max Ordering Distance (Meters)`.<br>• **Shortened Confirm Button**: Changed button text from `Save Operational & Distance Rules (Requires Confirmation)` strictly to `Confirm Action`.<br>• **Removed Operational State & Busy Mode Card**: Fully removed the `Operational State & Busy Mode` card (Busy Mode Switch, opening hours, address, phone, and staff account counters).<br>• **Relocated Refund Approvals Queue**: Moved the `Refund Approvals Queue` card into the first grid directly alongside the Timing Settings card, keeping the layout balanced and clean.<br>• **Removed Branch Menu Availability Toggles**: Completely removed the `Branch Menu Availability Toggles` card from Option 1 (`Branch Operations`), as menu item availability is managed in the dedicated `Menu & Prices` screen. |
| **Branch Manager Staff Accounts Small Screen Redesign (Single Overview Card, Horizontal Roles, Unified Controls Row & Scrollable Table)** | `BranchStaffManagement.tsx`<br>`globals.css`<br>`highlight.md` | • **Small Screen Banner Removal**: On small screens (`<= 768px`), completely removed the desktop top banner (`Branch Staff & Accounts Administration`, subtitle, and `+ Create Staff ID / Account`) via `.bm-staff-header-desktop`.<br>• **Single Mobile Overview Card (`.bm-staff-card-mobile`)**: Replaced with a single clean overview card displaying exclusively:<br>&nbsp;&nbsp;1. **Top Row**: `Branch Team {xyz} IDs` on the left and `+ Create Staff ID` button in the top right corner.<br>&nbsp;&nbsp;2. **Line 2**: `Active {activeStaffCount}` with emerald status dot.<br>&nbsp;&nbsp;3. **Line 3**: `Suspended {suspendedStaffCount}` with amber status dot.<br>&nbsp;&nbsp;4. **Line 4 (5-Column Grid)**: In one row, the positions (`Cashiers`, `Kitchen`, `Waiters`, `Support`, `Riders`), and directly below each word, the live count of people at that position (`{cashierCount}`, `{kitchenCount}`, `{floorCount}`, `{repCount}`, `{deliveryCount}`).<br>• **Horizontally Scrollable Roles Row**: Directly below the card, renders a horizontally scrollable pill row with roles: `All Roles`, `Cashiers`, `Kitchen`, `Waiters`, `Support`, and `Riders`. Selecting any role filters the staff list instantly.<br>• **Unified Search & View Mode Controls Row**: Directly below the roles row, renders Search input, Grid style button (`LayoutGrid`), and Row style button (`List`) all aligned in one single row.<br>• **Horizontally Scrollable Row Style (Table View)**: Table view is enclosed in an `overflowX: 'auto'` container with `minWidth: '720px'`, allowing staff rows to be smoothly scrolled horizontally on mobile screens without squashing columns or text. |
| **Staff 4-8 Hour Session Expiration & Auto-Logout on Refresh** | `AppContext.tsx`<br>`StaffAuth.tsx`<br>`app/src/app/staff/page.tsx`<br>`StaffLayout.tsx` | • **4–8 Hour Session Window (`STAFF_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000`)**: Staff login sessions are stamped with `foodies_staff_login_time = Date.now().toString()` upon successful sign-in in `StaffAuth.tsx`.<br>• **Shift Persistence**: As long as the staff member operates within 8 hours, browser refreshes keep them logged in at their active screen with all state and branch parameters intact.<br>• **Auto-Logout on Expiration**: If a staff member refreshes after 8 hours (or if session age exceeds 8h), `AppContext.tsx`, `page.tsx`, and `StaffLayout.tsx` automatically purge `foodies_staff_user`, `foodies_staff_role`, `foodies_staff_view`, and `foodies_staff_login_time`, cleanly forcing them to sign in again via `StaffAuth.tsx`.<br>• **Sign-Out Cleanup**: Explicitly signing out clears `foodies_staff_login_time` immediately. |
| **Small Screen Staff Web Static Sticky Header Lock** | `StaffLayout.tsx`<br>`globals.css` | • **Root Fixed Lock (`.staff-layout-root`)**: On mobile screens (`<= 768px`), the staff layout container is pinned with `position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; overflow: hidden !important;`, completely preventing the browser window or page body from scrolling away.<br>• **Header Statically Stuck (`.staff-header-inner`)**: Styled with `position: sticky !important; top: 0 !important; left: 0 !important; right: 0 !important; width: 100% !important; height: 60px !important; z-index: 1000 !important; flex-shrink: 0 !important;`, keeping the staff header 100% statically stuck at the top of the viewport across all small screen viewports.<br>• **Internal Content Scroll (`.staff-main-content`)**: Content area is constrained to `flex: 1 !important; height: calc(100vh - 60px) !important; max-height: calc(100vh - 60px) !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch !important;`, ensuring all screen content scrolls smoothly below the stationary header. |
| **Customer Small Screen Equal-Sized Checkout Card with Scrollable Items** | `CustomerCheckout.tsx`<br>`globals.css` | • **Equal Inner Card Geometry (`order_review`)**: The checkout order review card container on small screens is standardized to `height: 'clamp(250px, 48vh, 310px)'` and `maxHeight: 'clamp(250px, 48vh, 310px)'` with `padding: 'clamp(10px, 2.2vw, 14px) clamp(10px, 2.5vw, 16px)'`, matching the exact geometry, background, and borders of all subsequent stages (`fulfillment`, `details`, `branch_map`, `payment`).<br>• **Zero Card Layout Shifts / Size Jumps**: Advancing from the initial checkout card into guest auth, order options, delivery details, branch map, and payment methods maintains a 100% static, identical modal height without sudden resizing or jumping.<br>• **Scrollable Selected Items**: The cart items list container is styled with `flex: 1, minHeight: 0, overflowY: 'auto'`. When an order has multiple dishes exceeding the card height, the selected items scroll smoothly inside while the top items header, bottom total payable bar, and action buttons stay neatly pinned. |
| **Menu, Categories, Deals & Hero Slides Small Screen Adaptation** | `MenuAndPrices.tsx`<br>`globals.css`<br>`AppContext.tsx`<br>`MarketingHome.tsx` | • **Create New Menu Item Button**: Removed redundant `+` sign so it strictly renders with a single `+` icon/text (`Create New Menu Item`). On small screens (`<= 768px`), this desktop button is hidden from row 1.<br>• **Small Screen Tabs Row**: Made font size, padding, and card size of the 5 horizontal tab buttons (`Menu Items`, `Categories`, `Deals`, `Customer Services`, `Rep Permissions`) compact and small (`padding: 6px 9px`, `font-size: 11px`, `gap: 5px`, `border-radius: var(--radius-sm)`).<br>• **Second Row: 3-Quarter Scrollable Categories & 1-Quarter New Item Action**: In Menu Items, row 2 is split: 3 quarters (~75% width) contains a horizontally scrollable list of category pills (`All Items (7)`, `Biryani & Rice (1)`, `Shinwari & Karahi (2)`, `Burgers & Fast Food (1)`, `Tandoor & Breads (1)`, `Beverages & Desserts (2)`), and 1 quarter (~25% width) contains the `+ New Item` button.<br>• **Dishes Table Unscroolable Layout**: On small screens, columns `Category`, `Price`, and `Availability`, along with the description line in `Dish / Product`, are completely removed from the table view. Only `Dish / Product` and `Actions` columns are shown, making the table 100% unscroolable horizontally (`overflow-x: hidden`). Clicking "Edit" opens the complete edit modal with all fields to edit/write.<br>• **Deals Subtitle & Tag Removal**: In the Deals tab form and Live Preview, completely removed `Deal Subtitle / Preparation Detail` and `Badge / Tag *`. Ensured deals on the customer site and everywhere do not display subtitle or tag.<br>• **Hero Banner Slides & + New Slide**: Replaced `++ Add New Hero Banner Slide` with strictly `+ New Slide` (single plus icon and text `New Slide`). Configured hero carousel rotation to 5 seconds. On the customer site, hero slides do not display `Subtitle / Promo Description`. |
| **Option 4 Kitchen Monitor Clean Mobile Header ("Kitchen Status")** | `KitchenQueue.tsx`<br>`globals.css`<br>`highlight.md` | • **Streamlined Mobile Title**: In the 4th left slide option (`KitchenQueue.tsx`), on small screens (`<= 768px`), replaced verbose `Kitchen Operations Status Monitor` with strictly **`Kitchen Status`** (`.kitchen-title-mobile`).<br>• **Clutter Removal**: Completely removed / hid `👀 Read-Only Status Monitor` badge (`.kitchen-badge-desktop`), branch subtitle line `Branch: Gulberg Branch (Flagship) · Real-time kitchen status: Orders arrived today, accepted & prepared pipeline` (`.kitchen-desc-desktop`), and right-side button `1 Dishes Unavailable (View Stock)` (`.kitchen-stock-btn-desktop`).<br>• **Preserved Overview Pipeline**: Directly below `Kitchen Status`, the rest of the operational pipeline ("Orders Came Today", "Orders Accepted", "Orders Prepared", and live orders queue) renders as is. |
| **Option 6 Manager Profile Waiter & Floor Layout Reorder** | `FloorTables.tsx`<br>`StaffLayout.tsx`<br>`highlight.md` | • **Renamed Option 6**: Renamed Option 6 in the manager left sidebar / slide from `Floor & Table Seating` to `Waiter & Floor` (`waiter&floor`).<br>• **Header Clean Title**: In `FloorTables.tsx`, updated title from `Floor & Table Seating Oversight` to `waiter&floor`. Removed `OBSERVATION MODE` badge and branch subtitle line (`Branch: ... · Physical Table Utilization · Start-to-End Session History · Waiter Order Metrics`).<br>• **First Display KPI Cards**: Reordered layout so the 4 top KPI cards (`TABLES OCCUPIED TODAY`, `CURRENTLY OCCUPIED`, `AVG SEATING DURATION`, `DINE-IN REVENUE TODAY`) display first directly beneath the header.<br>• **Tabs Below KPI Cards**: Placed the 3 navigation tabs (`Table Occupancy Log (X)`, `Waiter Performance & Orders`, `Live Room Layout (Y)`) directly below the KPI cards, followed by the active tab details. |
| **Option 5 Cash Desk Monitor Mobile Polish, Calculation Report 3 Dropdowns & Clean Orders Stack** | `CashierDesk.tsx`<br>`globals.css`<br>`highlight.md` | • **Small Screen Header Text Removal**: On small screens (`<= 768px`), streamlined title to strictly **`Cash Desk`** (`.cashier-title-mobile`), completely removing `Monitor & Financial Oversight` from the header title. Completely removed / hid `OBSERVATION & APPROVAL MODE` badge (`.cashier-badge-desktop`) and the branch subtitle line `Branch: Gulberg Branch (Flagship) · Till Reconciliation · Shift Audits · Multi-Channel Orders · Refund Authorizations` (`.cashier-desc-desktop`).<br>• **Fast Mode Card Removal**: On small screens, completely removed / hid the `⚡ Fast Mode` banner card (`Displaying financial detailing of today only. Older records will only be fetched when you choose to load them.` and `📂 Fetch Older Data ⬇`) via `.cashier-fastmode-banner`.<br>• **3 Dropdowns in Calculation Report**: In the Calculation Report tab, replaced the horizontal filter buttons with 3 styled, responsive `<select>` dropdowns: (1) **Time Period** (`Today`, `Yesterday`, `Last 7 Days`, `All Time`, `Custom Range`), (2) **Channel** (`All Channels`, `Dine-In`, `Takeaway`, `Delivery`), and (3) **Shift of Cashier** (`All Shifts & Cashiers`, plus list of active/closed cashier shifts and staff accounts).<br>• **Shift History Handled via Dropdown**: Completely removed the `Per-Shift & Cashier History` tab button from the top switcher (`setManagerTab('shifts')`). When any specific shift is selected from the "Shift of Cashier" dropdown, the calculation report dynamically calculates metrics for that shift and renders a dedicated **Shift Reconciliation Audit card** (Opening Float, Cash Collected, Expected in Till, Counted Actual, Variance / Difference, Status, and Reason Notes).<br>• **Orders Tab Clean Vertical Stack (No Detail Billing Option)**: In the Orders tab (`managerTab === 'orders'`), on small screens, hid the master-detail full billing side-panel (`.cashier-order-detail-pane`) and the archive banner (`.cashier-orders-archive-banner`). The orders view directly displays the search bar (`Search order #, customer, phone, dish...`), the 4 channel filter pills (`All`, `Dine-In`, `Takeaway`, `Delivery`), and the list of orders stacked vertically with `#FC-XXXX`, type pill (`delivery`, etc.), customer name & items count (`Hamza Tariq · 2 item(s)`), amount (`Rs. 1,648.5`), and payment status (`PAID`), followed immediately by the next order and more below it. |
| **Option 7 Representative Customer Support Mobile Drill-Down Chat & Order History Pop-up Modal** | `RepresentativeInbox.tsx`<br>`globals.css`<br>`highlight.md` | • **First Click on Small Screens Shows People Name List with Complaints (Card 1)**: In Option 7 (`staff-rep` / Customer Support), on small screens (`<= 768px`), the workspace transitions into a responsive drill-down view where Card 1 (Customers with inquiries/complaints) takes 100% full width (`.rep-card-customers.rep-mobile-show`), hiding the chat panel and order history sidebar (`.rep-card-chat.rep-mobile-hide`, `.rep-desktop-only`).<br>• **Clicking Customer Row Opens Full Chat (Card 2)**: Clicking any customer's name row / complaint message calls `handleSelectCustomer` and transitions `mobileSupportView` to `'chat'`. On mobile screens, Card 2 (Full Live Chat) displays full width (`.rep-card-chat.rep-mobile-show`), while Card 1 is hidden (`.rep-card-customers.rep-mobile-hide`). Card 2 features a prominent `← Back` button (`.rep-mobile-back-btn`) to return to the customer list at any time.<br>• **Top Line Order History Option**: In the top line of the active chat along with customer name, phone, and inquiry info, provides a dedicated `[📜 Order History ({count})]` button.<br>• **Pop-Up Card Modal with Scrollable Order List**: Clicking the `Order History` button opens a pop-up modal card (`showOrderHistoryModal`) with customer summary metrics (Total Orders, Total Spend, Active Now), filter pills (`All`, `Active`, `Past`), and a scrollable order list (`maxHeight: '420px', overflowY: 'auto'`). Each order card displays order number, status badge, type, table/address, timestamp, total price, and items preview, with one-click access to the full itemized order bill. |
| **Option 8 Dine-In Orders Streamlined Header, Single Row Filter Dropdown & Right-Wall Search** | `RepresentativeInbox.tsx`<br>`highlight.md` | • **Clean Header Title**: In Option 8 (`staff-rep-dinein` / Dine-In Orders), streamlined the header title to strictly **`Dine-In Orders`**, completely removing ` — Table Service & Seating` and removing the explanatory subtitle paragraph `Incoming table orders: click order to view details or dispatch to kitchen / table`.<br>• **Single Dropdown with All Status & Filter Features**: Consolidated all previously scattered status badges and filter buttons into a single, clean `<select>` dropdown (`dinein-orders-filter-dropdown`) containing all features: `0 Ready / Served`, `0 Arrived`, `All (2)`, `Arrived (0)`, `In Kitchen (0)`, `Ready (0)`, and `Completed (2)`. Selecting any option dynamically filters the order list.<br>• **Right-Wall Fixed Search Option**: In that exact same header row immediately after the dropdown, positioned the search box (`Search order #, table, customer...`) pinned against the far right wall (`marginLeft: 'auto'`), creating a symmetrical, clean, and modern single-row header. |
| **Option 9 Takeaway Orders Streamlined Header, Single Row Filter Dropdown & Right-Wall Search** | `RepresentativeInbox.tsx`<br>`highlight.md` | • **Clean Header Title**: In Option 9 (`staff-rep-takeaway` / Takeaway Orders), streamlined the header title to strictly **`Takeaway Orders`**, completely removing ` — Counter Handover Hub` and removing the explanatory subtitle paragraph `Incoming takeaway requests: click order to view details or dispatch to kitchen`.<br>• **Single Dropdown with All Status & Filter Features**: Consolidated all previously scattered status badges and filter buttons into a single, clean `<select>` dropdown (`takeaway-orders-filter-dropdown`) containing all features: `0 Ready for Pickup`, `0 Arrived`, `All (1)`, `Arrived (0)`, `In Kitchen (0)`, `Ready (0)`, and `Completed (1)`. Selecting any option dynamically filters the takeaway order list.<br>• **Right-Wall Fixed Search Option**: In that exact same header row immediately after the dropdown, positioned the search box (`Search order #, customer...`) pinned against the far right wall (`marginLeft: 'auto'`), creating a clean, responsive single-row header. |
| **Option 11 Rider Operations Driver Card Cleanup & History Dropdown with Search** | `RiderDashboard.tsx`<br>`highlight.md` | • **Driver Detail Card Duty Lines Removal**: In the last manager option (`staff-rider` / Rider Operations), completely removed `Online (Ready)`, `Offline (Off Duty)`, and the `Go Offline` / `Go Online Now` toggle buttons from the driver detail card header, keeping the card focused purely on driver profile, branch, phone, deliveries count, and manager rider switcher.<br>• **History of Previous Days Dropdown**: When clicking on the `History of Previous Days` view (`mainView === 'history'`), replaced the 4 separate range buttons with a clean `<select>` dropdown (`rider-history-range-dropdown`) containing all 4 options: `Today`, `Yesterday`, `Past 7 Days`, and `All Past Days`.<br>• **Search Option Preceding Dropdown**: In that exact same row before the dropdown, positioned the search box (`Search past orders...`), providing instant keyword search by order number, customer name, phone, or address alongside date-range selection. |
| **Option 2 Branches & Staff: Select Branch Dropdown, Same-Line Cards/Table & Single-Line Filters** | `BranchesAndStaff.tsx`<br>`highlight.md` | • **Select Branch Dropdown**: In Option 2 (`mgmt-branches` / Branches & Staff), converted the horizontal branch button tabs under `Branch Staff ({count})` into a sleek `<select>` dropdown (`Select Branch:`) featuring:<br>&nbsp;&nbsp;1. `All Branches ({staffOnly.length})` (e.g. 17)<br>&nbsp;&nbsp;2. `F-7 Markaz Branch 5`<br>&nbsp;&nbsp;3. `Clifton Block 4 Branch 5`<br>&nbsp;&nbsp;4. `Gulberg Branch (Flagship) 7`<br>• **Cards & Table Toggle on Same Line**: In that exact same card line immediately after the branch select dropdown, positioned the `Cards` and `Table` view mode switcher buttons.<br>• **Single-Line Search, Roles & Statuses**: Consolidated the Search input, Staff Roles dropdown, and Statuses dropdown into one single horizontal line (`flex: 1` for search, fixed width for dropdowns) with clean spacing and zero wrapping.<br>• **Removed Subtitle**: Completely removed the subtitle text `Central multi-branch visibility · Staff accounts grouped strictly by branch · Zero customer exposure` below the header title. |
| **Universal Database Connectivity Verification & Complete Dummy Data Purge** | `database/seed.sql`<br>`app/src/lib/db.ts`<br>`AppContext.tsx`<br>`StaffLayout.tsx`<br>`api/audit-logs/route.ts`<br>`CustomerProfile.tsx`<br>`ProfileScreen.tsx` | • **Database Connectivity Verification**: Audited all 13 REST API routes (`/api/branches`, `/api/menu`, `/api/tables`, `/api/tables/sessions`, `/api/orders`, `/api/shifts`, `/api/refunds`, `/api/complaints`, `/api/users`, `/api/marketing`, `/api/audit-logs`, `/api/auth/email`, `/api/db/status`). Strengthened dual-engine connection in `db.ts` to seamlessly catch Node 26 `AggregateError` and fallback gracefully to embedded engine (`pg-mem`), adding robust fallback path resolution across server environments.<br>• **TypeScript Bug Fix in Staff Layout**: Resolved TS2367 comparison error on `OrderStatus` (`'confirmed'` -> `'placed' \|\| 'accepted'`), enabling 100% clean Next.js production builds.<br>• **Complete Removal of Dummy Orders**: Purged all mock orders (`ord-seed-1` to `ord-seed-4`, `FC-6744`, `FC-7819`, `FC-8812`, `FC-9021`) from `database/seed.sql`, `AppContext.tsx`, and customer/staff views.<br>• **Complete Removal of Dummy Refund Requests**: Purged mock refund requests (`ref-pending-1`, `ref-approved-1`) from `seed.sql`, database, and initial state.<br>• **Complete Removal of Mock Collections & Payments Received**: Reset `cash_shifts` to a clean opening drawer for Cashier Bilal Farooq (`opening_float: 5000, cash_collected: 0, expected_cash: 5000, status: 'open'`), removing past shifts with Rs. 34,200, Rs. 58,400, and Rs. 46,800 mock collections. All payment metrics start clean at Rs. 0.<br>• **Table Sessions & Status Reset**: Purged all dummy table sessions (`sess-1` to `sess-5`). All 13 tables across Lahore, Islamabad, and Karachi start in 100% `available` status with zero occupied locks.<br>• **Preserved Essential Operational Assets**: 100% retained all users (19 staff accounts across all branches + customers), authenticated roles & credentials, full order menu items & categories, branch details, table seating layouts, hero banners, deal cards, and footer settings. |
| **Tight 80mm Paid Slip & Thermal Receipt Print Layout (Zero Margins & Text-Fitted Vertical Length)** | `CashierDesk.tsx`<br>`CashierOrders.tsx`<br>`RepresentativeInbox.tsx`<br>`KitchenQueue.tsx`<br>`CustomerHistory.tsx`<br>`globals.css`<br>`highlight.md` | • **Staff & Customer Universal Print Button**: Updated the button label across cashier, representative order modal, and customer history to **"Print Order Paid Slip"**.<br>• **Zero-Margin @page & Body Sizing**: Configured `@page { size: 80mm auto; margin: 0 !important; padding: 0 !important; }` and `html, body { width: 80mm; margin: 0; padding: 0; height: auto; }` in thermal print iframes, completely removing all blank margins and paddings on left, right, and bottom.<br>• **Snug Text-Fitted Receipt Container**: `.receipt-container` is constrained to `width: 80mm; padding: 6px 8px 4px 8px; border: none; height: auto; min-height: 0; box-sizing: border-box;`. Thermal printers and browser print dialogs cut the printed page at the exact vertical length where text ends, with zero wasted whitespace at the bottom.<br>• **Preserved 135° Logo Watermark & Header Structure**: Preserves the official cafe logo watermark rotated at 135° (`opacity: 0.16`), clean branch metadata, itemized quantity/dishes/add-ons list, 16% GST calculation, total bill, and customer contact information. |
| **Permanent Removal of Default Refund Requests & Cashier Default Opening Amounts** | `database/seed.sql`<br>`app/src/lib/db.ts`<br>`api/refunds/route.ts`<br>`api/shifts/route.ts`<br>`api/orders/route.ts`<br>`api/tables/sessions/route.ts`<br>`AppContext.tsx`<br>`CashierDesk.tsx`<br>`CashierScreen.tsx`<br>`BranchManagerDashboard.tsx`<br>`OwnerOverviewScreen.tsx` | • **Permanent Deletion of Default Refund Requests**: Added SQL delete queries in `database/seed.sql` and startup execution in `db.ts` to purge all `refund_requests` rows (`ref-pending-%`, `ref-approved-%`, etc.). Hardened `/api/refunds` GET route with an exclusion clause and updated `AppContext.tsx` mount sanitization to wipe any stale refund requests from `localStorage` (`foodies_refunds_live`).<br>• **Zero Cashier Default Opening Float & Drawer Collections**: Reset `DEFAULT_OPEN_SHIFT` and `database/seed.sql` initial shift (`sh-today-1`) to `opening_float: 0`, `cash_collected: 0`, and `expected_cash: 0` (previously 5,000). Cleared prefilled `openingFloatInput` and `countedCashInput` from `CashierDesk.tsx` and `CashierScreen.tsx` so inputs start empty.<br>• **Fixed `|| 34200` JavaScript Coercion Bug**: Fixed `totalCashCollected` in `BranchManagerDashboard.tsx` and `BranchManagerScreen.tsx` from `currentShift?.cashCollected || 34200` to `Number(currentShift?.cashCollected || 0)`. When cash collected is 0, it properly renders Rs. 0 rather than falling back to 34,200.<br>• **Removed Mock Data from Management Screens**: Purged hardcoded sales/order offsets (Rs. 98,450, 142 orders, Rs. 68,400) and mock alert card ("Large Cash Refund Request on Order #FC-8492") from `OwnerOverviewScreen.tsx`. Replaced mock order reference in `CustomerHeader.tsx` notification with clean brand welcome text. |
| **Full Redux Toolkit Implementation, Traffic Jam Elimination & High-Speed Batch Synchronization** | `app/src/redux/`<br>`app/src/app/api/sync/route.ts`<br>`app/src/app/api/orders/route.ts`<br>`app/src/app/api/branches/route.ts`<br>`app/src/app/api/tables/route.ts`<br>`app/src/app/api/users/route.ts`<br>`app/src/app/api/marketing/route.ts`<br>`app/src/context/AppContext.tsx`<br>`app/src/app/layout.tsx`<br>`CustomerHeader.tsx`<br>`CustomerMenu.tsx`<br>`CustomerCheckout.tsx`<br>`StaffLayout.tsx`<br>`KitchenQueue.tsx`<br>`FloorTables.tsx`<br>`OwnerOverview.tsx`<br>`BranchManagerDashboard.tsx` | • **Redux Toolkit Core (`@reduxjs/toolkit` & `react-redux`)**: Installed and configured central Redux store (`app/src/redux/store.ts`) with typed hooks (`useAppDispatch`, `useAppSelector`) and 4 granular domain slices (`ordersSlice`, `cartSlice`, `cafeSlice`, `uiSlice`), wrapping the application in `<StoreProvider>`.<br>• **Root Cause of Web Slowness & Long Traffic Waiting Solved**: Diagnosed that every single GET request to `/api/orders`, `/api/branches`, `/api/tables`, `/api/users`, and `/api/marketing` was executing 20+ sequential `ALTER TABLE` DDL queries directly on PostgreSQL every 2.5s. These schema catalog locks blocked subsequent queries, causing catastrophic database lock queues and thread starvation. Wrapped all DDL column alterations in cached singleton guards (`ensureColumns()`), cutting per-request DDL operations to zero.<br>• **Consolidated Single-Request Batch Sync (`/api/sync`)**: Eliminated the legacy polling loop that fired 11 separate waterfall HTTP requests every 2.5 seconds (264 HTTP requests/min per tab). Replaced it with a high-performance batch endpoint `GET /api/sync?scope=live` that retrieves orders, tables, shifts, refunds, complaints, and sessions in a single database round-trip. Reduced network overhead by ~89%.<br>• **Non-Blocking Concurrency Lock & AbortController**: Implemented `syncEngine.ts` with an active `isSyncing` guard preventing duplicate concurrent sync requests from piling up in the browser connection queue. Added a 4.5s `AbortController` timeout to cleanly abort stalled requests.<br>• **Visibility-Aware Polling & Zero-Latency Multi-Tab Sync**: Automatically pauses syncing when the browser tab is hidden or backgrounded (`document.visibilityState === 'hidden'`), immediately refreshing when the tab regains focus. Combined with `BroadcastChannel('foodies_realtime_bus')` to propagate state changes across tabs instantly with zero network delay.<br>• **Redux Toolkit UI Integration & Memoized Selectors**: Replaced raw `.reduce()` and repeated multi-pass `.filter()` calculations with Redux Toolkit memoized selectors (`selectCartCount`, `selectCartSubtotal`, `selectTodayOrders`) and single-pass `useMemo` loops across `CustomerHeader`, `CustomerMenu`, `CustomerCheckout`, `StaffLayout`, `KitchenQueue`, `FloorTables`, `BranchManagerDashboard`, and `OwnerOverview`.<br>• **Zero Regressions & 100% Backward Compatibility**: Maintained the exact `useApp()` interface in `AppContext.tsx` powered directly by Redux Toolkit, while providing direct Redux exports (`useAppSelector`, `useAppDispatch`, `store`, slice actions) for modern component development. Verified 100% clean TypeScript type check and zero-error Next.js production build (`next build`). |
























