# FoodiesCafe — Product Requirements Document (PRD)

Version 1.0 · Draft for review · Multi-branch cafe web and app system

Items marked **\[Suggested\]** are recommendations, not confirmed decisions. Items marked **\[Open\]** need a decision before building. The database schema is intentionally excluded and will be designed separately.

## 1. Overview

### 1.1 Problem

FoodiesCafe operates several branches. Customers need an easy way to order food (dine-in, takeaway, delivery), and each branch team and the owner need one system to run daily service, tables, kitchen work, cash and customer support, with clear control over who can see and do what.

### 1.2 Product vision

One connected system with three interfaces on a single backend:

- **Customer app / website** — browse, order, edit orders, scan table QR codes, track orders, contact the cafe.
- **Staff dashboard** — branch manager, branch representative, kitchen, cashier, floor staff and delivery staff each see only what their job needs.
- **Management dashboard** — the owner sees all branches, staff, menu, prices, sales, cash, complaints, refunds and audit history.

Core principle: everyone uses the same system, but each person sees only the information and controls their role requires.

### 1.3 Goals

- Let customers order quickly from their phone, including by scanning a table QR code.
- Give kitchen, cashier and floor staff a live, simple view of orders and tables.
- Give the owner central visibility across branches and control over cash.
- Keep rules minimal at the start and expand later.

### 1.4 Non-goals (first release)

Online or card payments, loyalty points, ingredient-level inventory, driver GPS tracking, floor-plan editor, AI recommendations or chatbots, payroll and franchise accounting, multi-station kitchen routing.

### 1.5 Success measures \[Suggested\]

| Measure | Target idea |
| --- | --- |
| Orders flowing from customer to kitchen without staff re-entering | All app and QR orders |
| Cross-branch data access in permission tests | Zero |
| Cash difference at shift close | Tracked daily; differences explained |
| Average order-to-ready time | Tracked per branch |
| Complaint resolution time | Tracked per branch |
| Share of orders placed by app or QR | Tracked monthly |

## 2. Users and roles

A role defines what a person can do; a branch assignment defines where. One person may hold several roles. A branch manager never automatically receives owner permissions.

| Role | Main responsibility |
| --- | --- |
| Owner (platform\_owner) | All branches, global settings, access management |
| Branch manager | Daily operations and staff coordination for one branch |
| Branch representative | Customer queries, complaints, service recovery |
| Kitchen staff | Preparation queue and kitchen status |
| Cashier | Walk-in orders, cash collection, receipts |
| Floor staff / waiter | Tables, dine-in service, table requests |
| Delivery staff | Assigned deliveries and delivery status |
| Customer | Own profile, orders and complaints |

### Access rules that apply to every feature

1. **Branch isolation** — staff cannot read or change another branch's data by editing an ID in a URL or request.
2. **Server-side authorization** — the backend checks permissions on every sensitive action; hiding a button is not security.
3. **Customer isolation** — customers see only their own orders, complaints and details.
4. **No privilege escalation** — staff cannot give themselves roles or owner access.
5. **Least privilege** — each role gets the smallest set of permissions needed.
6. **Revocable access** — inactive staff can be locked out immediately.
7. **Audit** — important actions are recorded (see F18).

## 3. Release plan \[Suggested\]

| Release | Features |
| --- | --- |
| **Version 1 (pilot at one branch, multi-branch ready)** | F1–F20: accounts, staff and roles, branches, menu, cart and ordering (dine-in and takeaway), QR table ordering, tables, kitchen, order editing, cancellation, cash and shifts, refunds, complaints, notifications, confirmation popups, management dashboard, audit log, branch settings, abuse prevention |
| **Version 1.1** | F21 Order-ahead dine-in and time-slot reservations; F22 Delivery; SMS or WhatsApp notifications |
| **Later** | Online payments, loyalty, ingredient inventory, GPS tracking, floor-plan editor, AI features |

Every feature you requested is included in this document; the release tags only suggest build order.

## 4. Feature specifications

Each feature lists what it is, what is in scope, what is out of scope, and its key rules.

### F1. Customer accounts and authentication (v1)

**What it is:** Customers create and manage an account to order, track and edit orders.

**In scope**

- Register with phone and/or email; log in and log out.
- Change password.
- Update name, phone, email and saved address.
- View order history and receipts.
- Phone verification at registration \[Suggested\].

**Out of scope:** Social login, loyalty profile, customer-initiated account deletion.

**Key rules**

- Customers **cannot delete** their account; the delete option is not shown.
- Admins can suspend or deactivate an account. A customer may optionally request deactivation for admin review.
- The system should still allow an administrator to handle legally required privacy or deletion requests.
- &#91;Open\] Whether guests can order via QR without an account.

### F2. Staff accounts and role assignment (v1)

**What it is:** The owner creates staff accounts and assigns roles and branches.

**In scope**

- Owner creates, edits, suspends and deactivates staff accounts.
- Assign one or more predefined roles and one or more branches per staff member.
- Branch managers manage staff only within limits the owner grants.
- Confirmation popup before deactivating an account.

**Out of scope:** Custom permission editor, payroll, advanced shift scheduling.

**Key rules:** Staff cannot assign themselves roles; every role change is audited; deactivation takes effect immediately.

### F3. Branch management (v1)

**What it is:** The owner sets up and controls each cafe branch.

**In scope**

- Create and edit branches: name, address, phone, time zone, opening hours.
- Activate or deactivate a branch.
- Enable or disable delivery per branch (when delivery ships).
- Per-branch settings (see F19).

**Out of scope:** Franchise accounting, branch-to-branch stock transfers.

**Key rules:** Every order, table, complaint and cash record belongs to exactly one branch.

### F4. Menu management (v1)

**What it is:** A shared menu with branch-specific availability and optional price overrides.

**In scope**

- Owner manages categories and items: name, description, image, base price.
- Item options such as size and extras \[Suggested\].
- Branch manager marks items available or unavailable for their branch.
- Optional branch-specific price override set by the owner.
- Kitchen can report an item as unavailable.

**Out of scope:** Ingredient-level inventory, recipe costing, automatic purchasing.

**Key rules**

- Only the owner changes global menu items and prices; managers change availability only.
- Changing a price requires a confirmation popup and is audited.
- Orders keep a snapshot of the item name, options and price so old receipts never change.

### F5. Customer menu browsing and cart (v1)

**What it is:** Customers choose a branch, browse its menu and build a cart.

**In scope**

- Select a branch; see that branch's menu, prices, images and availability.
- Add items, quantities, options and special instructions to the cart.
- Unavailable items are visible but cannot be ordered.
- Branch closed or ordering paused: ordering is disabled with a clear message.

**Out of scope:** Coupons, loyalty redemption, personalised recommendations.

**Key rules:** The backend calculates all prices and totals; the customer device is never trusted. Adding to cart needs no confirmation popup.

### F6. Order placement: dine-in and takeaway (v1)

**What it is:** The core flow that turns a cart into an order for the branch.

**In scope**

- Choose dine-in or takeaway; for takeaway, pickup time or as soon as ready.
- Server validates availability, price, branch, hours and totals before confirming.
- Confirmation popup before submitting the order.
- Order appears in the branch queue; customer sees live status.
- Order history, receipt (with cash status), reorder from a past order, contact staff.
- Duplicate prevention: retrying after a network failure never creates two orders.

**Out of scope:** Online payment, split bills, group orders.

**Key rules**

- Order status, payment status and table status are three separate pieces of information; none overrides the others.
- Order statuses: placed, accepted, preparing, ready, out for delivery (delivery only), completed, cancelled.
- Every status change is recorded with who changed it and when.

### F7. QR table ordering (v1)

**What it is:** Each table has a QR code. Scanning it opens the ordering page for that branch and table.

**In scope**

- One unique QR code per table, identifying branch and table.
- On scan, the system checks table status: available tables allow ordering; reserved or occupied tables show a clear message with options to view available tables or ask staff.
- Customer browses, orders and pays cash at the cafe.
- Orders attach to the table's dining session so several people at one table do not mix up visits.

**Out of scope:** Paying by phone, split payment per person, seat-level ordering.

**Key rules**

- The QR contains an unguessable identifier, never a password or secret; codes can be replaced if leaked.
- The backend **rechecks availability when the order is submitted**, not just at scan time.
- If two customers claim the same table at once, only one succeeds.
- A customer cannot mark a table free or override a reservation.
- &#91;Suggested\] Staff confirm seating before the first QR order is accepted, so someone with a photo of the QR cannot claim a table remotely.

### F8. Table management and dining sessions (v1)

**What it is:** A live table grid for floor staff, with separate tracking of reservations and real table use.

**In scope**

- Table grid per branch with statuses: available, reserved, occupied, cleaning, unavailable.
- Floor staff update status for their assigned area; managers for the whole branch.
- Live updates for all staff and for customers' QR scans.
- Confirmation popup before marking a table free.

**Out of scope:** Drag-and-drop floor-plan editor.

**Key rules**

- A table is never marked free just because an order was placed or an estimated time passed; staff confirm it is empty and ready.
- Cleaning must be cleared before the table is offered again.
- A **reservation** is a future commitment; a **dining session** is actual use. They are tracked separately.
- No two confirmed reservations for the same table may overlap in time.
- Each table belongs to one branch and has a unique number in it.

### F9. Kitchen queue (v1)

**What it is:** A live screen where the kitchen sees and progresses orders.

**In scope**

- Incoming orders for the branch with number, items, quantities, options and instructions.
- Add-on items shown as new additions to an existing order.
- Mark preparing and ready; set or adjust the estimated preparation time; report unavailable items.
- Confirmation popup when marking food ready.
- Printable ticket \[Suggested\] and tolerance for brief internet drops \[Suggested\].

**Out of scope:** Multiple kitchen stations with separate routing, ingredient tracking.

**Key rules:** Kitchen cannot see customer account details, revenue or payroll; cannot issue refunds, delete orders silently or mark an order paid.

### F10. Order editing — two-stage rule (v1)

**What it is:** Customers can change an order after placing it, within rules that protect the kitchen. Managers control the timing.

**In scope**

| Stage | When | Customer can |
| --- | --- | --- |
| 1. Full edit | Before preparation starts | Add or remove items, change quantities, options and instructions; subtotal recalculated |
| 2. Add-ons only | Preparation started, before the add-on deadline | Add new items or increase quantities; cannot remove or reduce original items; add-ons carry their own subtotal |
| 3. Locked | At or after the add-on deadline | No changes; can track the order and contact staff |
| Closed | Order ready or served | No changes; contact staff if something is wrong |

- Manager-set values per branch (with optional per-order override): full-edit window, estimated preparation time, add-on cutoff before ready time.
- Example: ready at 19:00 and add-ons close 10 minutes before, so customers can add until 18:50.
- Confirmation popup showing previous total, new total and changes before saving.
- Add-ons are stored as separate groups so the kitchen sees what is new and the cashier sees the updated amount due.
- After preparation starts, other changes (such as removals) need a change request approved by kitchen or manager.

**Out of scope:** Editing after the order is ready or served; automatic substitutions.

**Key rules**

- Full editing ends at whichever comes first: the window expires, or the kitchen starts preparation \[Suggested\].
- If the ready time moves later, the add-on deadline moves with it and the customer is told. If the order is ready early, add-ons close immediately.
- Original items become immutable once preparation starts; an add-on subtotal is calculated from current branch prices.
- The server enforces these rules even if the customer bypasses the screen. The order is locked during a change so customer and kitchen cannot conflict, and stale edits are rejected.
- Every accepted change is recorded with who, what, when, and the old and new totals.

### F11. Order cancellation (v1)

**What it is:** Customers and staff can cancel orders under a clear policy.

**In scope**

- Customer cancels freely before preparation starts \[Suggested\].
- After preparation starts, cancellation goes through staff approval; the manager records a reason.
- Confirmation popup before cancelling; customer is notified.

**Out of scope:** Automated cancellation fees.

**Key rules:** \[Open\] The exact policy after preparation starts (wasted-food cost). If cash was already collected, the refund process (F13) applies.

### F12. Cash payments, cashier shifts and reconciliation (v1)

**What it is:** Cash-only payment recording with controls so the owner can check cash against orders.

**In scope**

- Customers see only cash as a payment method.
- Orders start as unpaid (cash due). Cashier or authorized staff records cash received; confirmation popup shows the amount.
- Pay at counter, at the table, or on delivery (delivery in v1.1), recorded by the authorized person.
- Receipts for each cash payment.
- Cashier shifts with opening float and closing count; end-of-day reconciliation of expected versus counted cash, with a reason for any difference \[Suggested\].

**Out of scope:** Card, mobile wallet and online payments (the design keeps room to add them later).

**Key rules:** Payment status is separate from preparation status; kitchen can never mark an order paid; add-on amounts are included in the amount due.

### F13. Refunds (v1)

**What it is:** A controlled way to return cash for valid cases.

**In scope**

- Staff or customer **request** a refund; an authorized person **approves** within an owner-set limit.
- Each refund records amount, reason, requester, approver and time.
- Confirmation popup showing amount and reason.

**Out of scope:** Automatic refunds, refunds to online payment methods.

**Key rules:** Refunds cannot exceed the amount paid; large refunds, suspected fraud and repeated complaints go to management. \[Open\] The approval limit per role.

### F14. Complaints and branch representative dashboard (v1)

**What it is:** The branch representative is the main contact between customers and the cafe.

**In scope**

- Customers submit queries and complaints, optionally linked to an order.
- Representative dashboard: new items, related order number and status, reply box, status, message history and resolution.
- Workflow: new, in progress, resolved, closed.
- Assign or escalate to manager or owner.

**Out of scope:** Chatbots, voice or phone-call logging, social media inbox.

**Key rules**

- Representatives handle routine issues for their own branch and approve refunds only within the owner's limit.
- Safety complaints, suspected fraud, repeated complaints and large refunds go to management.
- Only the customer and authorized staff see a private conversation.
- Every complaint has an assigned owner and a status so none is lost.

### F15. Notifications (v1)

**What it is:** Keeping customers informed about their order.

**In scope**

- In-app updates for: order confirmed, estimate set or changed, delayed, ready, cancelled, add-on window changed, complaint reply.
- Web push where supported; do not rely on it alone, especially on iPhones \[Suggested\].

**Out of scope (v1):** SMS and WhatsApp (v1.1, with customer consent).

**Key rules:** A separate "ready" message is sent only when food is actually ready. If the kitchen is delayed, the estimate is updated instead of sending a misleading message.

### F16. Confirmation popups (v1)

**What it is:** A Yes / No popup shown **before** important actions, instead of a warning afterwards.

**In scope**

| Action | Popup? |
| --- | --- |
| Add to cart, view menu or order | No |
| Submit order | Yes |
| Edit or save order changes | Yes (old and new totals) |
| Cancel an order | Yes |
| Mark a table free; change a reservation | Yes |
| Mark food ready | Yes |
| Record cash payment | Yes (amount) |
| Approve a refund | Yes (amount and reason) |
| Change menu price or timing settings | Yes |
| Deactivate a staff account | Yes |
| Delete or permanently remove data | Yes, with stronger safeguards |

**Key rules:** The popup states exactly what will happen with clear No and Yes buttons. It is a convenience, not security; the backend still checks permissions after the user confirms.

### F17. Management dashboard and reports (v1)

**What it is:** Central visibility for the owner, with branch-level views for managers.

**In scope**

- Owner: all branches, orders, sales, cash reconciliation, complaints, refunds, staff and audit history.
- Branch manager: the same views limited to their branch.
- Daily sales and order summaries; cash reports by shift and day.

**Out of scope:** Advanced analytics, forecasting, accounting integration.

**Key rules:** Financial reports are visible only to owner and branch manager; cashiers see only their own shift totals.

### F18. Audit log (v1)

**What it is:** A permanent record of important actions.

**In scope:** Refunds, price changes, role and account changes, cancellations, timing-setting changes, manual table overrides, cash corrections. Each entry records who, what, when and which branch.

**Key rules:** Entries cannot be edited by staff; owner sees all, managers see limited branch history.

### F19. Branch operations settings (v1)

**What it is:** Settings that let each branch control how it operates.

**In scope**

- Opening hours; ordering paused or busy mode \[Suggested\].
- Full-edit window, estimated preparation time, add-on cutoff, ready-notice lead time (default 10 minutes).
- Limit on active unpaid orders per customer.

**Key rules:** Managers change settings for their branch; every change is confirmed and audited.

### F20. Abuse prevention for cash-only ordering (v1) \[Suggested\]

**What it is:** Protection against fake orders and fake table claims when no prepayment exists.

**In scope:** Phone verification; limit on active unpaid orders; no-show counter with restrictions after repeated no-shows; staff seating confirmation for QR; rate limits on login and ordering.

**Out of scope:** Fraud scoring, deposits.

### F21. Order-ahead dine-in and table reservations (v1.1)

**What it is:** Customers order from home, pick a table, and arrive when food is nearly ready.

**In scope**

- Choose branch and dine-in, then select a table or arrival time.
- Fixed time-slot reservations \[Suggested\]; the system confirms a table only when it can be safely allocated.
- Scheduled preparation near the required time.
- About 10 minutes before ready: "Your food will be ready in about 10 minutes. You can start coming."
- Reservation and food schedule stay coordinated; no-shows are counted.

**Out of scope:** Predicting when occupied tables will free up.

**Key rules:** An occupied table stays unavailable until staff confirm it is free; the reminder comes from the kitchen's current estimate, not a blind timer.

### F22. Delivery (v1.1)

**What it is:** Delivery orders paid in cash on handoff.

**In scope**

- Customer enters a delivery address; delivery fee shown at checkout; only for branches with delivery enabled.
- Manual rider assignment; statuses: unassigned, assigned, picked up, delivered, failed.
- Rider sees only assigned deliveries; cash collection recorded on handoff.
- Support can see delivery status for complaints.

**Out of scope:** GPS tracking, route optimization, delivery zones with automatic pricing.

**Key rules:** Only the assigned rider updates a delivery; failed deliveries are escalated to the branch manager.

## 5. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Security | Server-side authorization, branch isolation, hashed passwords, rate limiting, signed or unguessable QR identifiers |
| Reliability | No duplicate orders on retry; transaction-safe order, edit and table claims; daily backups that can be restored |
| Live updates | Kitchen queue and table status update without refresh |
| Performance | Menu and order screens load quickly on mobile networks |
| Usability | Works on phones as a web app first; simple screens for busy staff |
| Language | \[Open\] English and/or Urdu |
| Privacy | Collect only needed customer information |
| Observability | Error reporting, monitoring and audit trails |

## 6. Assumptions and risks

- **Scope growth:** the design has grown beyond a minimum; phasing keeps the first release manageable.
- **Cash-only risk:** fake orders and cash mismatches; mitigated by F12 and F20.
- **Table prediction:** estimating when tables free up is unreliable; staff confirmation is required.
- **Notifications:** web push is unreliable on some phones; in-app updates are the baseline.
- **Tax and invoicing:** Pakistan tax and invoice rules should be checked with an accountant.
- **Small team:** a heavy technology stack increases delivery risk; start with a web app and simple infrastructure.

## 7. Open decisions

| # | Question |
| --- | --- |
| O1 | Can guests order by QR without an account? |
| O2 | Is delivery in version 1 or 1.1? (Suggested: 1.1) |
| O3 | Are reservations in version 1, or only QR ordering? (Suggested: fixed time slots only) |
| O4 | Who approves refunds, and up to what amount? |
| O5 | Cancellation policy after preparation starts |
| O6 | Languages: English, Urdu or both? |
| O7 | Tax and invoice requirements |
| O8 | Notification channels: in-app only, web push, SMS or WhatsApp? |

## 8. Next steps

Following the step-by-step approach: confirm the version 1 scope (Section 3), settle the open decisions one at a time (Section 7), then move to the database schema and Phase 1 development.
