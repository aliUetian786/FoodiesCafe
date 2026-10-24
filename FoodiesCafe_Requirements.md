# FoodiesCafe — Web & App System
## Complete Requirements, Rules, Architecture and Implementation Plan

**Version:** 1.0 (consolidated draft)
**Scope:** Multi-branch cafe system with customer ordering, branch operations and central management.
**Note:** The database schema is intentionally not included yet; it will be designed separately.

> **How to read this document**
> - Everything you asked for is included.
> - Items marked **[Suggested]** are my recommendations from the review, not your decisions. Accept or reject them one by one.
> - Items marked **[Open]** need a decision from you or the cafe owner before coding.
> - Phase tags (**v1**, **v1.1**) are a suggested build order, not a removal of any feature.

---

## 1. Project Summary

FoodiesCafe is one connected system with three interfaces on a single backend and database:

1. **Customer app / website** — browse menu, order, choose dine-in / takeaway / delivery, track orders, edit orders, scan table QR codes, contact the cafe.
2. **Staff / branch dashboard** — branch manager, branch representative, kitchen, cashier, floor staff and delivery staff each see only what their job needs.
3. **Management dashboard** — owner and authorized admins see all branches, staff, menu, prices, sales, complaints, refunds and audit history.

**Guiding principle:** everyone uses the same system, but each person sees and controls only what their role requires. Start with few, clear rules; expand later.

---

## 2. Decisions Already Made

| # | Decision |
|---|---|
| 1 | Multiple branches, centrally managed by the owner |
| 2 | Order types: dine-in, takeaway, delivery |
| 3 | **Cash only** for now (no card / mobile / online payment) |
| 4 | Dine-in customers can order ahead from home and pick a table (free now or expected free soon) |
| 5 | Customer receives a "your food will be ready in ~10 minutes, you can come now" notification |
| 6 | Every table has a QR code for ordering; reserved tables show as reserved |
| 7 | Floor staff / representative marks tables free; table status updates live |
| 8 | A branch representative handles customer queries and complaints |
| 9 | Important actions use a **Yes / No confirmation popup**, not an after-the-fact warning |
| 10 | Customers **cannot delete** their account; they can update their details |
| 11 | Customers can edit orders under a **two-stage rule** with manager-configurable times (Section 10) |
| 12 | Start with minimal rules, then expand |

## 3. Open Decisions

| # | Question | Why it matters |
|---|---|---|
| O1 | Can guests order by QR **without an account**? | Affects abuse control, notifications and order history |
| O2 | Is delivery in v1 or v1.1? **[Suggested: v1.1]** | Adds addresses, zones, fees, riders, cash on handoff |
| O3 | Are table reservations in v1, or only QR ordering? **[Suggested: fixed time-slot reservations only]** | Predicting "free soon" is unreliable |
| O4 | Who can approve refunds and up to what amount? | Owner must set the limit |
| O5 | Cancellation policy after preparation starts | Wasted food cost |
| O6 | Languages: English, Urdu, or both? | UI and notification text |
| O7 | Tax / invoice rules for Pakistan | Check with an accountant |
| O8 | Real-time delivery of notifications: in-app only, web push, SMS or WhatsApp? | Web push is unreliable on iPhones |

---

## 4. Scope and Phasing **[Suggested]**

### Version 1 (first pilot, one branch)
- Multiple-branch data model (but pilot at one branch)
- Roles, permissions, branch isolation
- Menu with branch availability
- Customer ordering: dine-in and takeaway
- QR table ordering with live table status
- Kitchen queue and live status
- Cash payment recording and cashier shift reconciliation
- Order editing (two-stage)
- Branch representative complaints
- Confirmation popups
- Audit logs

### Version 1.1
- Delivery with rider assignment
- Order-ahead dine-in with scheduled preparation and "come now" notifications
- Time-slot table reservations
- SMS / WhatsApp notifications

### Later
- Online payments (JazzCash, Easypaisa, cards)
- Loyalty points and memberships
- Ingredient-level inventory and purchasing
- Driver GPS tracking and route optimization
- Floor-plan editor
- AI recommendations or chatbots
- Franchise accounting and payroll
- Multiple kitchen stations with complex routing

---

## 5. Architecture

```
Customer app/web      Staff dashboards      Owner dashboard
        \                    |                    /
          ------ Secure REST API + Auth ------
                          |
            Backend (modular monolith)
   Auth · Orders · Menu · Tables · Payments(cash)
   Support · Delivery · Notifications · Reports · Audit
                          |
                    PostgreSQL
                          |
        Background jobs: notifications, scheduled tasks
```

**Rules**
- One backend, one database, one deployable (modular monolith, not microservices).
- The backend checks permissions on every sensitive action. Hiding a button is not security.
- Customer and staff interfaces use the same API with different permissions.

### Technology stack

| Layer | Original recommendation | **[Suggested]** simpler start |
|---|---|---|
| Web (customer + staff) | Next.js + TypeScript | Same |
| Mobile app | React Native | **PWA first**, native app later |
| Backend | FastAPI (Python) or NestJS | Pick one, not both |
| Database | PostgreSQL | Same |
| Live updates | WebSockets | **Server-sent events** are simpler for one-way updates |
| Background jobs | Redis-backed worker | Add Redis only when needed; start with a DB-backed job table |
| Images | S3-compatible storage | Same |
| Hosting | Managed API, web and PostgreSQL | Same |

---

## 6. Roles and Permissions

A **role** defines what someone can do; a **branch assignment** defines where. One person may hold several roles. A branch manager does **not** automatically get owner permissions.

### Roles

| Role | Responsibility |
|---|---|
| platform_owner | All branches, global settings, access management |
| branch_manager | Daily operations and staff coordination for one branch |
| branch_representative | Customer queries, complaints, service recovery |
| kitchen_staff | Preparation queue and kitchen status |
| cashier | Walk-in orders, cash collection, receipts |
| floor_staff | Tables, dine-in service, table requests |
| delivery_staff | Assigned deliveries and delivery status |
| customer | Own profile, orders, complaints |

### Permission matrix

Legend: **Full** = all records · **Branch** = assigned branch only · **Own** = own records · **Limited** = only the specific action needed · **—** = no access

| Feature | Owner | Branch manager | Representative | Kitchen | Cashier | Floor | Delivery | Customer |
|---|---|---|---|---|---|---|---|---|
| View all branches | Full | — | — | — | — | — | — | — |
| Manage branches | Full | — | — | — | — | — | — | — |
| Staff accounts and roles | Full | Limited, if granted | — | — | — | — | — | — |
| Branch orders | Full | Branch | Limited (support) | Kitchen queue | Order desk | Dine-in | Assigned deliveries | Own |
| Change kitchen status | Full override | Branch oversight | — | Assigned orders | — | — | — | — |
| Record cash payment | Full oversight | Branch oversight | — | — | Assigned orders | Limited, if granted | Delivery cash, if policy allows | — |
| Refunds | Full | Limited approval | Request / escalate | — | Request / escalate | — | — | Request |
| Menu and prices | Full | Branch availability only | — | Report unavailable | — | — | — | View |
| Order-timing settings | Full | Branch | — | — | — | — | — | — |
| Table status | Full | Branch | View if needed | — | View if needed | Assigned area | — | View / request |
| Reservations | Full | Branch | View | — | View | Branch | — | Own |
| Delivery status | Full | Branch | View for support | — | View | — | Assigned | Own |
| Complaints | Full | Branch oversight | Assigned branch | — | Limited handoff | Limited handoff | Delivery handoff | Own |
| Sales reports | Full | Branch | — | — | Own shift totals | — | — | Own payments |
| Audit history | Full | Limited branch history | Own actions | — | — | — | — | — |

### Non-negotiable access rules
1. **Branch isolation:** a Branch A employee cannot read or change Branch B data by editing an ID in a URL or API request.
2. **Server-side authorization** on every sensitive action.
3. **Customer isolation:** customers read only their own orders, payments, addresses and complaints.
4. **No privilege escalation:** staff cannot assign themselves roles or grant owner access.
5. **Financial separation:** kitchen status never implies payment status.
6. **Controlled refunds:** amount, reason, approver recorded.
7. **Auditability:** price changes, cancellations, role changes, refunds, timing-setting changes are logged.
8. **Least privilege:** smallest permission set needed for the job.
9. **Revocable access:** inactive staff access can be disabled immediately.
10. A `branch_id` sent by the frontend is only a requested filter; the server validates it against the user's assignments.

For version 1, use predefined roles; no custom permission editor.

---

## 7. Single Source of Truth for Statuses

Keep **three separate pieces of information** for every dine-in order: order status, payment status and table status. They influence one another but never automatically override each other.

| Entity | Allowed values |
|---|---|
| **Order status** | `placed` → `accepted` → `preparing` → `ready` → (`out_for_delivery`) → `completed`; also `cancelled` |
| **Payment status** | `unpaid`, `paid`, `partially_refunded`, `refunded` |
| **Table status** | `available`, `reserved`, `occupied`, `cleaning`, `unavailable` |
| **Reservation status** | `requested`, `confirmed`, `seated`, `cancelled`, `completed`, `no_show` |
| **Complaint status** | `new`, `in_progress`, `resolved`, `closed` |
| **Refund status** | `requested`, `approved`, `rejected`, `completed` |
| **Delivery status** | `unassigned`, `assigned`, `picked_up`, `delivered`, `failed` |
| **Amendment status** | `pending`, `accepted`, `rejected` |
| **User status** | `active`, `suspended`, `deactivated` |

Customer-facing labels may be friendlier (Confirmed, Preparing, Ready, Completed) but map to these values.

---

## 8. Customer Features and Ordering Rules

### 8.1 Customer can
- Register, log in, log out, change password.
- Update name, phone, email and address.
- Browse a branch's menu with prices, images and availability.
- Place dine-in, takeaway or delivery orders.
- Edit an order (when permitted), cancel (when permitted), reorder, view receipt, track status.
- Scan a table QR code and order from that table.
- Submit queries and complaints; see their own history.
- **Cannot delete their account.**

### 8.2 Ordering rules
1. Customer selects a branch and sees that branch's available menu and prices.
2. Customer adds items, quantities and allowed options to the cart.
3. Customer selects dine-in, takeaway or delivery.
4. The backend validates availability, price, branch, tax and total before confirming.
5. The order appears in that branch's order queue.
6. The customer sees status updates and can contact the branch.

**Important:**
- Prices and totals are calculated by the backend, never trusted from the device.
- Unavailable items cannot be ordered.
- Retrying after a network failure must not create a duplicate order (idempotency key per checkout).
- Orders store a **snapshot** of item names, prices and tax so old receipts never change.

### 8.3 Order types

| Type | Needs | Notes |
|---|---|---|
| Dine-in | Table (now, or assigned/reserved later) | Order-ahead supported |
| Takeaway | Pickup time or "as soon as ready" | Customer collects and pays cash at counter |
| Delivery | Address, delivery fee, rider | Cash on delivery; only where branch delivers |

### 8.4 Account rules

| Action | Customer |
|---|---|
| Register / log in / log out | Allowed |
| Update name, phone, email, address | Allowed |
| Change password | Allowed |
| View order history | Allowed |
| Delete account | **Not allowed** |
| Request deactivation | Optional; admin reviews |
| Admin disables account | Allowed for authorized staff |

The delete button is omitted. The system should still be able to honor legally required privacy or deletion requests handled by an administrator.

---

## 9. Dine-in, Tables, QR Codes and Reservations

### 9.1 Table states

| State | Meaning | Who can change it |
|---|---|---|
| Available | Ready for a new customer | Floor staff, manager |
| Reserved | Held for a confirmed booking | System, manager, authorized staff |
| Occupied | A customer is using it | Floor staff |
| Cleaning | Customer left; needs cleaning | Floor staff |
| Unavailable | Out of service | Manager, authorized staff |

**Rules**
- Every table belongs to one branch and has a unique number within it.
- A table is never marked free just because an order was placed or an estimated time passed. Staff confirm the table is empty and ready.
- Cleaning must be cleared before the table is offered again.
- A customer cannot mark their table free or override a reservation.
- No two confirmed reservations for the same table may overlap in time.
- Reservations (future commitment) and dining sessions (actual table use) are **separate records**.
- Version 1 uses a table **grid** with statuses, not a seat-map editor.
- Table status updates **live** for all staff.

### 9.2 Scenario A — Order ahead from home
1. Customer selects branch and dine-in.
2. Customer sees available tables and, optionally, tables expected to be free soon.
3. Customer selects a table or arrival time and places the order.
4. Kitchen schedules preparation near the required time.
5. About 10 minutes before ready, customer gets: *"Your food will be ready in about 10 minutes. You can start coming to the cafe."*
6. Customer arrives to a table and food that are ready.

**Rules**
- A table currently occupied stays unavailable until staff confirm it is free. An estimated departure time is not a guarantee.
- The system may *suggest* tables expected to free up, but confirms the reservation only when the table can be safely allocated. **[Suggested]** In v1, use fixed time-slot reservations only.
- The reminder comes from the kitchen's current estimate or an explicit staff action, not a blind timer.
- If the kitchen is delayed, update the estimate and notify the customer instead of sending a misleading message.
- A separate "Your order is ready" notification is sent when the food is actually ready.
- Table reservation and food schedule stay coordinated.

### 9.3 Scenario B — Arrive and scan the table QR
1. Customer scans the table's QR code (identifies branch and table).
2. The backend checks the table's status.
3. If available: customer browses, orders, and pays cash at the cafe.
4. If reserved or occupied by another active session: show a clear message with **View available tables** and **Ask staff**.
5. The kitchen receives the order; floor staff see its progress.

> **This table is currently reserved**
> This table is reserved for another customer. Please choose an available table or ask our staff for assistance.

**QR security rules**
- The QR holds an unguessable table identifier or signed reference, never a secret or password.
- The backend **rechecks availability when the order is submitted**, not only at scan time.
- If two customers claim the same table at once, only one succeeds.
- Orders attach to a **dining session**, so several people at one table can order without mixing visits.
- **[Suggested]** Anti-abuse: staff confirm seating before the first QR order is accepted, or a short on-table code/PIN is used, so someone with a photo of a QR cannot claim a table remotely.
- QR codes can be rotated if leaked.

---

## 10. Order Editing (Two-Stage, Manager-Controlled)

### 10.1 Stages

| Stage | When | Customer can |
|---|---|---|
| **1 — Full edit** | Before preparation starts | Add/remove items, change quantities, options, instructions. Subtotal recalculated. |
| **2 — Add-ons only** | Preparation started, before the add-on deadline | Add new items or increase quantities only. Cannot remove or reduce original items. Add-ons have their own subtotal. |
| **3 — Locked** | At or after the add-on deadline | No changes. Can track and contact staff. |
| **After ready/served** | Order ready or served | Closed. Contact staff if something is wrong. |

### 10.2 Manager settings (per branch, optional per-order override)

| Setting | Example |
|---|---|
| Full-edit window after placement | 15 minutes |
| Estimated preparation time | 25 minutes |
| Stop accepting add-ons before ready time | 10 minutes |
| Expected ready time | 19:00 |

Example: ready at 19:00 with add-ons closing 10 minutes before → customers can add until **18:50**.

All changes to these settings are recorded in the audit log.

### 10.3 Clarified rules **[Suggested]**
- **Full-edit ends at whichever comes first:** the window expires, or the kitchen starts preparation.
- If the manager moves the ready time later, the add-on deadline moves with it and the customer is notified.
- If the order is ready early, add-ons **close immediately**.
- For scheduled orders, the configured ready time determines the deadline; for immediate orders, the current estimated ready time does, recalculated when staff adjust it.
- Changing prices or removing items after preparation begins requires **staff approval** through a change request.

### 10.4 Subtotal example

| Item | Amount |
|---|---|
| Chicken burger × 1 (original) | Rs. 450 |
| Fries × 1 (original) | Rs. 200 |
| **Original subtotal (locked)** | **Rs. 650** |
| Chicken burger × 1 (add-on) | Rs. 450 |
| **Add-on subtotal** | **Rs. 450** |
| **Updated total (before tax/discount)** | **Rs. 1,100** |

Original items become immutable once preparation starts. Each add-on is stored as a separate **amendment group**, so the kitchen sees what was added later and the cashier sees the updated amount due.

### 10.4 Backend validation for saving an edit
1. Authenticate the user; confirm they own the order (or are authorized staff).
2. Lock the order row so kitchen and customer cannot conflict.
3. Check the `version` number sent by the client matches the stored version.
4. Determine the current stage from status, `preparation_started_at`, full-edit window and `add_on_cutoff_at`.
5. Stage 1: allow all edits. Stage 2: reject removals/reductions; allow additions only. Stage 3 or later: reject.
6. Recalculate prices from **current branch prices**, availability and tax on the server.
7. Show the confirmation popup with previous total, new total and changes.
8. On Yes: save items, amendment, history record and audit entry in **one transaction**; bump `version`.
9. Notify the kitchen of the change; update the customer.

### 10.5 Cancellation **[Open — O5]**
Suggested policy: free cancellation before preparation starts; after that, only through staff approval, with a manager able to record the reason and any wasted-food cost.

---

## 11. Kitchen Rules

- Kitchen sees incoming orders for their branch: order number, items, quantities, instructions, add-on groups (highlighted as new).
- Kitchen marks: preparing → ready, or reports an item unavailable.
- Kitchen sets or adjusts the **estimated preparation time**.
- Kitchen **cannot** see customer account details, revenue or payroll, issue refunds, delete orders silently, or mark an order paid.
- Payment status and preparation status are separate fields.
- Every status change writes a history record.
- **[Suggested]** Printable kitchen ticket and an offline-tolerant screen that reconnects gracefully.

---

## 12. Cash Payments

### 12.1 Rules

| Situation | Behavior |
|---|---|
| Order placed | Payment status `unpaid` (cash due) |
| Pays at counter | Cashier records amount received |
| Pays at table | Authorized staff records collection |
| Pays on delivery | Delivery staff or cashier records collection per policy |
| Customer cancels, no cash taken | Stays unpaid |
| Customer cancels, cash taken | Follow refund policy |
| Order completed | Order and payment statuses checked independently |

- The customer UI shows **cash only**; no gateway or callbacks needed.
- The data model keeps a `method` field so online payments can be added later without redesign.
- Recording cash shows a confirmation popup with the amount.

### 12.2 Cash control **[Suggested]**
Cash-only means the owner needs a way to check money against orders:
- Cashier **shifts** with opening float and closing count.
- A **cash drawer** record per shift.
- **End-of-day reconciliation** report: expected cash (from orders) vs. counted cash, with difference and reason.
- Receipts for every cash payment.

### 12.3 Refunds
- Staff **request**; an authorized person **approves** within an owner-set limit.
- Each refund records amount, reason, requester, approver and time.
- Refunds cannot exceed the amount actually paid.
- Large refunds, suspected fraud and repeated complaints go to management.

---

## 13. Branch Representative and Complaints

The representative is the main contact between customers and the cafe.

**Dashboard:** new queries and complaints; related order number and status; reply box; complaint status; assign/escalate to manager or owner; message history and resolution.

**Workflow:** `new` → `in_progress` → `resolved` → `closed`

**Rules**
- Representatives handle routine questions and service issues for their own branch.
- They approve refunds only within the owner-set limit.
- Safety complaints, suspected fraud, repeated complaints and large refunds go to management.
- Only the customer and authorized staff see a private complaint conversation.
- Every complaint has an assigned owner and a status so none gets lost.

---

## 14. Notifications

| Event | Customer notified? |
|---|---|
| Order confirmed | Yes |
| Estimated time set or changed | Yes |
| "About 10 minutes to ready — you can come now" | Yes (if opted in, and order type supports it) |
| Order delayed | Yes |
| Order ready | Yes |
| Order cancelled | Yes |
| Add-on window changed | Yes |
| Complaint reply | Yes |

**v1:** in-app updates. **[Suggested]** Add SMS/WhatsApp later with customer consent; web push is unreliable on iPhones, so do not depend on it alone.

---

## 15. Confirmation Popups (Yes / No)

Use a popup **before** the action runs, stating exactly what will happen. Do not confirm trivial clicks.

| Action | Confirmation? |
|---|---|
| Add item to cart; view menu or order | No |
| Submit a new order | Yes |
| Edit or save order changes | Yes (show old and new totals) |
| Cancel an order | Yes |
| Mark a table free | Yes |
| Change a table reservation | Yes |
| Mark food ready | Yes |
| Record cash payment | Yes (show amount) |
| Approve a refund | Yes (show amount and reason) |
| Change menu price | Yes |
| Change timing settings | Yes |
| Deactivate a staff account | Yes |
| Delete or permanently remove data | Yes, with stronger safeguards |

Example:

> **Save changes to your order?**
> You changed your order from 2 items to 3 items.
> Previous total: Rs. 850 · New total: Rs. 1,050
> **[No, go back]  [Yes, confirm]**

A popup is a **UI safeguard only**. The backend still checks authorization and validates the action after confirmation.

---

## 16. Other Operational Rules

| Area | Rule |
|---|---|
| Menu | Each item has name, price, category, image, availability. Shared menu with branch-specific availability and optional price override. |
| Item options | **[Suggested]** Model sizes and extras (modifiers), not only plain items. |
| Inventory | Manager marks items unavailable when ingredients run out. |
| Discounts | Only authorized roles create or apply them. |
| Staff shifts | Each staff member is assigned to a branch and role. |
| Opening hours | **[Suggested]** Per-branch hours; ordering disabled outside them. |
| Busy mode | **[Suggested]** Pause new orders or extend prep time. |
| Audit history | Log refunds, price changes, role changes, cancellations, timing changes. |
| Account security | Staff authenticate; access revocable. |
| Privacy | Collect only needed customer information. |
| Languages | **[Open — O6]** English and/or Urdu. |
| Tax and invoices | **[Open — O7]** Verify Pakistan tax/invoice rules with an accountant. |

---

## 17. Abuse Prevention for Cash-Only **[Suggested]**

Without prepayment, fake orders and fake table claims are easy.
- Phone verification at registration.
- Limit on **active unpaid orders** per account.
- **No-show counter**; repeated no-shows restrict order-ahead or reservations.
- Staff confirm seating before the first QR order is accepted.
- Rate limiting on order and login endpoints.
- Delivery orders above a value may require a phone confirmation.

---

## 18. API Design (suggested contracts)

| Module | Example endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Account | `PATCH /me`, `POST /me/password` |
| Branches | `GET /branches`, `GET /branches/{id}` |
| Menu | `GET /branches/{id}/menu`, `PATCH /branches/{id}/menu/{itemId}` |
| Orders | `POST /orders`, `GET /orders/{id}`, `PATCH /orders/{id}` (edit), `POST /orders/{id}/cancel`, `GET /staff/orders` |
| Order changes | `POST /orders/{id}/add-ons`, `POST /orders/{id}/change-requests`, `POST /change-requests/{id}/decide` |
| Kitchen | `PATCH /staff/orders/{id}/status`, `PATCH /staff/orders/{id}/estimate` |
| Cash | `POST /staff/orders/{id}/cash-payments`, `POST /staff/shifts/open`, `POST /staff/shifts/{id}/close` |
| Refunds | `POST /payments/{id}/refund-requests`, `POST /refunds/{id}/approve` |
| Tables | `GET /staff/branches/{id}/tables`, `PATCH /staff/tables/{id}` |
| QR | `GET /qr/{token}` (table status), `POST /qr/{token}/orders` |
| Reservations | `POST /reservations`, `GET /staff/reservations` |
| Complaints | `POST /complaints`, `GET /staff/complaints`, `POST /complaints/{id}/messages` |
| Delivery | `POST /staff/orders/{id}/assign-delivery`, `PATCH /delivery/{id}/status` |
| Settings | `GET/PUT /management/branches/{id}/order-settings` |
| Management | `GET /management/reports/sales`, `GET /management/reports/cash`, `GET /management/audit-logs` |

Each endpoint needs request validation, authorization, error handling, idempotency where relevant and tests. Live updates (kitchen queue, table grid) use server-sent events or WebSockets.

**How to protect a branch endpoint (e.g. `/staff/orders`):** authenticate → load active roles and branch assignments → restrict results to authorized branches → check permission before any change → write sensitive changes to the audit log.

---

## 19. Order Workflow (summary)

1. Customer picks branch and items → backend validates menu, prices, availability, hours and unpaid-order limit.
2. Order created with idempotency key; status `placed`, payment `unpaid`.
3. Branch accepts → kitchen sets estimate → full-edit window and add-on cutoff are computed.
4. Kitchen starts preparation → full editing ends → add-ons only.
5. Notification "ready in ~10 minutes" when the kitchen's estimate says so.
6. Kitchen marks `ready` → add-ons close → customer notified.
7. Dine-in: served at table. Takeaway: collected. Delivery: rider assigned → `out_for_delivery` → delivered.
8. Cash recorded by authorized staff → `paid`. Order `completed`.

---

## 20. Implementation Plan

| Phase | Focus | Deliverable |
|---|---|---|
| **1 Foundation** | Repo, environments, migrations, auth, roles, branch assignments, access checks | Secure login and role-based dashboards; branch isolation tested |
| **2 Catalog** | Branches, menu, options, branch availability, opening hours, customer menu and cart | Customers see the right menu per branch |
| **3 Orders and kitchen** | Dine-in and takeaway ordering, price snapshots, idempotency, kitchen queue, status history | Orders flow from customer to kitchen |
| **4 Tables and QR** | Table grid, dining sessions, QR ordering, live status, seating confirmation | QR ordering with correct table availability |
| **5 Cash and editing** | Cash recording, shifts, reconciliation, two-stage order editing, timing settings, confirmation popups, refunds | Reliable cash tracking and rule-enforced edits |
| **6 Support and notifications** | Complaints, representative dashboard, in-app notifications, ready-soon notice | Branch staff run daily service from one dashboard |
| **7 Delivery and reservations (v1.1)** | Delivery assignment, time-slot reservations, order-ahead scheduling | Delivery and order-ahead dine-in |
| **8 Launch** | Permission, concurrency and cash tests; monitoring, backups, audit; pilot one branch; roll out others | Production-ready release |

Finish and test each phase before starting the next.

---

## 21. Acceptance Checklist

- [ ] **Branch isolation:** Branch A staff cannot read or change Branch B data.
- [ ] **Menu and pricing:** customers see the selected branch's prices and availability.
- [ ] **Duplicate orders:** retrying checkout never creates two orders.
- [ ] **Kitchen permissions:** kitchen updates preparation status but cannot refund or mark paid.
- [ ] **Customer privacy:** a customer cannot open another customer's order or complaint by changing an ID.
- [ ] **Cash accuracy:** cash totals match recorded orders; shift reconciliation works.
- [ ] **Refund controls:** refunds need authorization and cannot exceed the amount paid.
- [ ] **Table claims:** two simultaneous QR orders for one table result in only one success.
- [ ] **Reserved table:** QR scan of a reserved table shows the reserved message and blocks ordering.
- [ ] **Reservation overlap:** conflicting confirmed bookings are rejected.
- [ ] **Edit stages:** removals rejected after preparation starts; add-ons rejected after cutoff; early-ready closes add-ons.
- [ ] **Concurrent edits:** simultaneous customer and kitchen changes do not conflict (version check works).
- [ ] **Confirmation popups:** shown for every action in Section 15; backend still enforces permissions.
- [ ] **Account rules:** customers have no delete option; admins can suspend or deactivate.
- [ ] **Delivery handoff (v1.1):** only the assigned rider can update their deliveries.
- [ ] **Recovery:** backups restore successfully and failures are observable.

---

## 22. Recommended Project Structure

```
cafe-system/
├── apps/
│   ├── customer-web/
│   ├── staff-dashboard/
│   └── mobile-app/          # optional; PWA first
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── branches/
│   │   ├── menu/
│   │   ├── orders/
│   │   ├── payments/        # cash, shifts, refunds
│   │   ├── tables/          # tables, QR, sessions, reservations
│   │   ├── delivery/
│   │   ├── complaints/
│   │   ├── notifications/
│   │   ├── reports/
│   │   └── audit/
│   ├── migrations/
│   └── tests/
├── shared/
│   └── api-types/
├── infrastructure/
└── README.md
```

Generate frontend types from the backend's OpenAPI specification so the API remains the source of truth.

---

## 23. Recommended Next Steps

Following your step-by-step approach, I suggest we settle things in this order, confirming each before moving on:

1. **Scope:** confirm what is in v1 vs v1.1 (Section 4).
2. **Open decisions O1–O8** (Section 3).
3. **Status lists and the editing-rule conflicts** (Sections 7 and 10.3).
4. **Cash-control and abuse-prevention rules** (Sections 12.2 and 17).
5. **Database schema** (deliberately left out of this document; we will design it later), then start Phase 1.
