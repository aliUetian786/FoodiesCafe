# FoodiesCafe - Supabase PostgreSQL Deployment Guide

This guide explains how to connect your FoodiesCafe web application (on Vercel) and mobile app to **Supabase PostgreSQL** for permanent, real-time data persistence across all branches, devices, and serverless lambdas.

---

## 🚀 Step 1: Create a Free Supabase Project (2 Minutes)

1. Go to [supabase.com](https://supabase.com) and sign in or sign up.
2. Click **New Project**.
3. Enter project details:
   - **Name**: `foodies-cafe`
   - **Database Password**: Choose a strong password and **save it securely** (you will need it for the connection string).
   - **Region**: Select the region closest to Pakistan / your users (e.g. `ap-south-1` Mumbai or `ap-southeast-1` Singapore).
4. Click **Create new project** and wait ~1 minute for Supabase to provision your PostgreSQL database.

---

## 📜 Step 2: Run the All-In-One Database Setup Script

We have generated an all-in-one setup file: [`database/supabase_setup.sql`](file:///c:/Users/ua/Desktop/FoodiesCafe/database/supabase_setup.sql).

1. In your Supabase Dashboard, click on **SQL Editor** in the left sidebar.
2. Click **+ New Query**.
3. Copy the entire contents of [`database/supabase_setup.sql`](file:///c:/Users/ua/Desktop/FoodiesCafe/database/supabase_setup.sql).
4. Paste it into the SQL editor and click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
5. You will see a success message:
   ```
   FoodiesCafe database initialized successfully for Supabase!
   ```

> **What this script sets up automatically:**
> - All 20 tables: `branches`, `users`, `categories`, `menu_items`, `tables`, `orders`, `order_history`, `cash_shifts`, `refund_requests`, `audit_logs`, `hero_banners`, `deal_cards`, `banner_deal_approval_requests`, `footer_settings`, `table_sessions`, `announcements`, `email_otps`, `notifications`, `notification_settings`, `receiver_notification_settings`.
> - All required indexes, foreign keys, and idempotency constraints.
> - Default master seed data (3 branches in Lahore, Islamabad, Karachi; authentic menu items with sizes and extras; staff accounts; tables with PINs; default notification rules).
> - Permissions granting full access to standard Supabase roles (`postgres`, `service_role`).

---

## 🔑 Step 3: Copy Your Supabase Connection String

1. In Supabase Dashboard, click on the **Project Settings** (gear icon at bottom left).
2. Go to **Database** (under Configuration).
3. Scroll down to the **Connection string** section.
4. Select the **URI** tab:
   - For serverless environments like Vercel, select **Transaction Mode** (Pooler, port `6543`) or **Session Mode** (port `5432`).
   - The connection string looks like this:
     ```
     postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
     *(Or direct URI if using session mode: `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`)*
5. Replace `[YOUR-PASSWORD]` with the actual database password you chose in Step 1.

---

## ⚙️ Step 4: Add `DATABASE_URL` to Vercel

1. Open your [Vercel Dashboard](https://vercel.com/dashboard).
2. Select your `FoodiesCafe` project.
3. Go to **Settings** -> **Environment Variables**.
4. Add or update the following environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Your Supabase connection string from Step 3.
   - **Environments**: Check all (Production, Preview, Development).
5. Click **Save**.
6. Go to the **Deployments** tab on Vercel:
   - Click the three dots `...` next to the latest deployment -> click **Redeploy** (or push a new commit to GitHub).

---

## ✅ Step 5: Verify Live Connection

Once Vercel redeploys:

1. **Readiness Probe**:
   Open in your browser:
   `https://foodies-cafe-ky7bgu5wt-aliraza8.vercel.app/api/ready` (or your latest domain)
   Expected response:
   ```json
   {
     "ready": true,
     "database": {
       "ready": true,
       "engine": "PostgreSQL (Live Server)"
     }
   }
   ```

2. **Branches API**:
   Open: `https://foodies-cafe-ky7bgu5wt-aliraza8.vercel.app/api/branches`
   Expected response: HTTP 200 with all branches and delivery amounts.

3. **Place an Order**:
   - Customer Web / Mobile App places an order.
   - Cashier and Kitchen Hub instantly receive the order.
   - Order remains in history and does not oscillate or vanish.
