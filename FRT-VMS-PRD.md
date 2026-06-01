# FRT Vehicle Management System (FRT-VMS)
### Product Requirements Document — The Imperial Electric Company
**Version:** 2.0 | **Date:** June 2026 | **Prepared for:** Internal Use — Multi-Circle Deployment

---

## 1. Project Overview

### 1.1 Background

The Imperial Electric Company operates FRT (Fault Rectification Teams) vans across **multiple circles** under government contracts with MVVNL/UPPCL. Each circle has multiple divisions, each division has multiple substations. Currently, vehicle deployment records, driver assignments, interchange history, and compliance documents are managed manually (registers, Excel, WhatsApp). This leads to:

- No central visibility across circles — HQ cannot see the full picture
- Interchange history lost when registers change hands
- Driver shift records incomplete or scattered across divisions
- Vehicle document expiry (insurance, fitness, pollution) missed
- No cross-circle comparison or reporting
- No audit trail for transfer approvals

### 1.2 Objective

Build a **multi-circle, web-based Vehicle Asset Management System** that:

- Supports any number of circles, each with their own divisions and substations
- Maintains permanent master records for every FRT van company-wide
- Tracks current substation deployment with full hierarchy (Circle → Division → Substation)
- Preserves complete interchange/transfer history — including cross-circle transfers
- Records driver assignments per shift with full history
- Alerts on expiring vehicle documents
- Provides role-based access: HQ sees all, Circle Incharge sees own circle, Division Incharge sees own division

### 1.3 Operational Hierarchy

```
The Imperial Electric Company (HQ)
│
├── Zone (optional grouping, e.g. Central UP, Eastern UP)
│   │
│   ├── Circle (e.g. Barabanki, Lucknow, Rae Bareli, Sitapur)
│   │   │
│   │   ├── Division (e.g. Barabanki, Fatehpur, Haidergarh, Ramnagar, Ramsanehighat)
│   │   │   │
│   │   │   └── Substation (e.g. Trivediganj, Haidergarh Town, etc.)
```

> **Note:** Zones are optional. The core enforced hierarchy is **Circle → Division → Substation**.  
> A vehicle belongs to a Circle (contract-level) but is deployed at Substation level.

### 1.4 Scope — Phase 1 (Web Only)

- Web portal (Progressive Web App, mobile-responsive)
- Multi-circle from day one — no rework needed later
- No Android native app in Phase 1
- No GPS live tracking in Phase 1 (only GPS device metadata stored)
- Initial deployment: EDC Barabanki (5 divisions) + extensible to other circles

---

## 2. Tech Stack

### 2.1 Frontend

| Layer | Technology | Reason |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | SSR + static pages = rocket speed |
| Styling | **Tailwind CSS + shadcn/ui** | Consistent UI, mobile-responsive, fast dev |
| State | **Zustand** | Lightweight, no boilerplate |
| Forms | **React Hook Form + Zod** | Type-safe validation, no re-renders |
| Tables | **TanStack Table v8** | Virtual rows for large multi-circle datasets |
| Charts | **Recharts** | Circle-wise comparison charts on dashboard |
| Icons | **Lucide React** | Clean, consistent |

### 2.2 Backend

| Layer | Technology | Reason |
|---|---|---|
| Backend | **Supabase** | PostgreSQL + Auth + Realtime + Storage, all-in-one |
| Database | **PostgreSQL (via Supabase)** | Relational, JOINs across 5-level hierarchy |
| Auth | **Supabase Auth + RLS** | Row-Level Security enforces circle/division isolation |
| Storage | **Supabase Storage** | Document uploads per vehicle |
| API | **Supabase REST + RPC functions** | No separate API server needed |

### 2.3 Hosting & Speed

| Concern | Solution |
|---|---|
| Frontend | **Vercel** — global CDN, instant deploys |
| Database | **Supabase** (free → Pro as scale increases) |
| Performance | Next.js static shell + background data fetch with SWR |
| Speed target | Dashboard shell < 300ms, data < 1.5s on 4G |

---

## 3. User Roles & Permissions

| Role | Who | Scope | Permissions |
|---|---|---|---|
| **Super Admin** | Company HQ / IT | All circles, all data | Full CRUD, user management, master data |
| **Zonal Manager** | Zone head (if applicable) | Assigned zone's circles | View + reports across zone, approve cross-circle transfers |
| **Circle Incharge** | EDC / Circle head | Own circle only | View all divisions in circle, approve transfers within circle |
| **Division Incharge** | Division manager | Own division only | Full CRUD for own division vehicles, drivers, assignments |
| **Viewer** | SDO / Field supervisor | Own division or circle | Read-only |

### 3.1 Row-Level Security (RLS) Rules

Supabase RLS policies enforce data isolation automatically:

```
Super Admin     → SELECT/INSERT/UPDATE/DELETE on ALL rows
Zonal Manager   → SELECT on vehicles WHERE circle IN (own_zone_circles)
Circle Incharge → SELECT on vehicles WHERE circle_id = own_circle
                  INSERT/UPDATE on vehicle_assignments WHERE circle_id = own_circle
Division Incharge → Full access WHERE division_id = own_division
Viewer          → SELECT only WHERE circle_id = own_circle OR division_id = own_division
```

---

## 4. Database Schema

### 4.1 Hierarchy / Master Tables

```sql
-- Zone (optional top-level grouping)
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,          -- 'Central UP', 'Eastern UP'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Circle (main contract/operational unit)
CREATE TABLE circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,          -- 'Barabanki', 'Lucknow', 'Rae Bareli'
  zone_id UUID REFERENCES zones(id),  -- nullable (zone is optional)
  state TEXT DEFAULT 'Uttar Pradesh',
  discom TEXT DEFAULT 'MVVNL',        -- MVVNL / DVVNL / PVVNL / PuVVNL
  contract_ref TEXT,                  -- E-Tender No. if applicable
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Division
CREATE TABLE divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                 -- 'Barabanki', 'Fatehpur', 'Haidergarh'
  circle_id UUID NOT NULL REFERENCES circles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, circle_id)
);

-- Substation
CREATE TABLE substations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  division_id UUID NOT NULL REFERENCES divisions(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, division_id)
);
```

### 4.2 Vehicle Master

```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  registration_no TEXT UNIQUE NOT NULL,  -- 'UP32AB1234'
  vehicle_type TEXT,                      -- 'Bolero', 'Pickup', 'Scorpio'
  fuel_type TEXT,                         -- 'Diesel' / 'Petrol' / 'CNG'
  model_year INT,

  -- Ownership
  owner_name TEXT,
  owner_mobile TEXT,
  vendor_name TEXT,                       -- Contractor/company name

  -- GPS
  gps_company TEXT,                       -- 'Airtel GPS', 'Trackpoint', etc.
  gps_device_id TEXT,                     -- IMEI / Device serial

  -- Circle linkage (which circle this vehicle is contracted to)
  circle_id UUID NOT NULL REFERENCES circles(id),

  -- Document expiry
  insurance_expiry DATE,
  fitness_expiry DATE,
  pollution_expiry DATE,
  rc_copy_url TEXT,                       -- Supabase Storage URL

  -- Status
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','maintenance','breakdown','removed','standby','accident')),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast circle-wise queries
CREATE INDEX idx_vehicles_circle ON vehicles(circle_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
```

### 4.3 Driver Master

```sql
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mobile TEXT,
  license_no TEXT,
  license_expiry DATE,
  address TEXT,

  -- Driver belongs to a circle (can be assigned to any division within that circle)
  circle_id UUID NOT NULL REFERENCES circles(id),

  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_drivers_circle ON drivers(circle_id);
```

### 4.4 Assignment & History Tables

```sql
-- Current Deployment (one active row per vehicle)
CREATE TABLE vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  circle_id UUID NOT NULL REFERENCES circles(id),
  division_id UUID NOT NULL REFERENCES divisions(id),
  substation_id UUID NOT NULL REFERENCES substations(id),
  assigned_from DATE NOT NULL,
  assigned_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vehicle_id)   -- only one current assignment per vehicle
);

-- Transfer / Interchange History (append-only, NEVER delete)
CREATE TABLE vehicle_transfer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),

  -- From location (full hierarchy stored for historical accuracy)
  from_circle_id UUID REFERENCES circles(id),
  from_division_id UUID REFERENCES divisions(id),
  from_substation_id UUID REFERENCES substations(id),

  -- To location
  to_circle_id UUID REFERENCES circles(id),
  to_division_id UUID REFERENCES divisions(id),
  to_substation_id UUID REFERENCES substations(id),

  transfer_date DATE NOT NULL,
  reason TEXT,              -- 'Interchange', 'Breakdown Redeployment', 'Administrative', 'Cross-Circle Transfer'
  approved_by TEXT,
  remarks TEXT,
  is_cross_circle BOOLEAN GENERATED ALWAYS AS (from_circle_id != to_circle_id) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transfer_vehicle ON vehicle_transfer_history(vehicle_id);
CREATE INDEX idx_transfer_date ON vehicle_transfer_history(transfer_date);

-- Vehicle Status History (append-only)
CREATE TABLE vehicle_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  status TEXT NOT NULL,
  remarks TEXT,
  from_date DATE NOT NULL,
  to_date DATE,             -- NULL = currently in this status
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Driver Shift Assignment History (append-only)
CREATE TABLE driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  shift TEXT CHECK (shift IN ('morning','evening','night')),
  from_date DATE NOT NULL,
  to_date DATE,             -- NULL = currently assigned
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_driver_assign_vehicle ON driver_assignments(vehicle_id);
```

### 4.5 User Profile Table (linked to Supabase Auth)

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('super_admin','zonal_manager','circle_incharge','division_incharge','viewer')),
  circle_id UUID REFERENCES circles(id),     -- NULL for super_admin / zonal_manager
  division_id UUID REFERENCES divisions(id), -- NULL unless division_incharge or viewer
  zone_id UUID REFERENCES zones(id),         -- for zonal_manager
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.6 Key Business Rules

- A vehicle has one `circle_id` (its home circle), but can be **deployed at any substation** including in another circle via cross-circle transfer.
- Transfer within same circle → `is_cross_circle = false`; requires Circle Incharge approval.
- Transfer across circles → `is_cross_circle = true`; requires Super Admin or Zonal Manager approval.
- **Never hard-delete** any row in history tables. Only status flags and `to_date` updates.
- When vehicle transferred: INSERT into `vehicle_transfer_history`, then UPDATE `vehicle_assignments`.
- When driver replaced: UPDATE `to_date` on old row, INSERT new `driver_assignments` row.

---

## 5. Application Pages & Features

### 5.1 Dashboard (Home)

**URL:** `/dashboard`

**Top-level view (Super Admin / Zonal Manager):**

- Company-wide summary cards:
  - Total Circles Active
  - Total Vehicles
  - Active Vehicles
  - Under Maintenance / Breakdown
  - Documents Expiring ≤ 30 Days (red badge)
  - Total Active Drivers

- **Circle-wise breakdown table:**

| Circle | Total Vehicles | Active | Maintenance | Breakdown | Expiring Docs |
|---|---|---|---|---|---|
| Barabanki | 45 | 40 | 3 | 2 | 5 |
| Lucknow | 38 | 35 | 2 | 1 | 2 |

- Click any circle row → filtered vehicle list for that circle.

**Circle Incharge view:** Shows only their circle with division breakdown.

**Division Incharge view:** Shows only their division's vehicles.

**Recent Activity Feed (all roles):**
Last 10 transfers/status changes within visible scope.

---

### 5.2 Vehicle List

**URL:** `/vehicles`

**Filters (cascading dropdowns):**
Circle → Division → Substation → Status → Vendor

**Columns:**
Reg No | Type | Circle | Division | Substation | Status | GPS | Doc Status | Actions

- Color-coded status badges
- Document expiry icons (🟡 expiring, 🔴 expired)
- Click row → Vehicle Profile
- **Add Vehicle** button (Division Incharge+)
- **Export Excel** button

---

### 5.3 Vehicle Profile

**URL:** `/vehicles/[id]`

**Header bar:** Registration No | Circle badge | Division | Current Status badge

**Tab 1 — Overview**
- Master details: Type, Owner, Vendor, GPS Company, GPS Device ID, Fuel, Model Year
- Home Circle, Current Deployment (Circle → Division → Substation → Since Date)
- Document expiry with traffic-light colors
- Quick action buttons: Transfer Vehicle | Change Status | Edit Details

**Tab 2 — Current Drivers**
- 3 cards: Morning / Evening / Night shift
- Each: Driver Name | Mobile | License No | Assigned Since
- "Change Driver" button on each card

**Tab 3 — Transfer History**
- Vertical timeline, newest first
- Each entry: Date | From (Circle / Substation) | To (Circle / Substation) | Reason | Approved By
- Cross-circle transfers shown with special 🔄 badge
- Permanent, no delete

**Tab 4 — Status History**
- Timeline: Date | Status | Remarks | Duration

**Tab 5 — Driver History**
- All drivers ever assigned: Driver | Shift | From | To | Duration

**Tab 6 — Documents**
- Insurance / Fitness / Pollution / RC — upload, view, update expiry

---

### 5.4 Transfer Vehicle

**URL:** `/vehicles/[id]/transfer`

**Form:**

```
Transfer Date          [date picker — required]
From Circle            [auto-filled, read-only]
From Division          [auto-filled, read-only]
From Substation        [auto-filled, read-only]

──── New Deployment ────

To Circle              [dropdown — all circles]
To Division            [filtered by selected circle]
To Substation          [filtered by selected division]

Reason                 [dropdown: Interchange / Redeployment / Breakdown / Administrative / Cross-Circle]
Approved By            [text — required]
Remarks                [textarea — optional]
```

If `To Circle ≠ From Circle` → show warning banner:
> ⚠️ This is a **Cross-Circle Transfer**. Approval from Zonal Manager / HQ required.

On submit:
1. INSERT `vehicle_transfer_history`
2. UPDATE `vehicle_assignments`
3. Show success summary with transfer details

---

### 5.5 Drivers

**URL:** `/drivers`

- Filter by Circle (scoped by role)
- Columns: Name | Mobile | License No | License Expiry | Circle | Currently Assigned To | Status
- Add / Edit driver
- Driver Profile: all vehicle assignments with dates

---

### 5.6 Alerts & Expiry Monitor

**URL:** `/alerts`

**Tabs:**
- Vehicle Documents (Insurance / Fitness / Pollution) expiring ≤ 30 days
- Driver Licenses expiring ≤ 30 days
- Vehicles with no driver assigned in any shift

Each tab shows a table with direct link to fix. Filterable by Circle.

---

### 5.7 Reports

**URL:** `/reports`

| Report | Filters | Output |
|---|---|---|
| Circle-wise Deployment Summary | Date, Circle | Vehicles per circle/division/substation |
| Vehicle Movement Report | Date range, Circle | All transfers with from/to |
| Cross-Circle Transfer Report | Date range | Only inter-circle moves |
| Driver Duty Report | Date range, Circle | Driver → Vehicle → Shift history |
| Document Compliance Report | Circle, Doc type | Expiry status across fleet |
| Vendor Fleet Report | Circle, Vendor | Vehicles by vendor/owner |
| Division-wise Active Fleet | Circle | Current snapshot |

All reports exportable to Excel (using `xlsx` library).

---

### 5.8 Admin Panel

**URL:** `/admin`

- **User Management** — create users, assign role + circle/division scope, disable
- **Master Data:**
  - Zones (add/edit)
  - Circles (add/edit, link to zone, set DISCOM/contract ref)
  - Divisions (add/edit, link to circle)
  - Substations (add/edit, link to division)
- **System Settings** — company name, logo, expiry alert threshold (default 30 days)

---

## 6. UI / UX Design Principles

### 6.1 Philosophy — "Koi Bhi Samjhe"

Users range from tech-savvy HQ staff to field supervisors accessing on phone browsers. Design rules:

- **Cascading dropdowns** everywhere — Circle → Division → Substation, never free text for location
- **Status = Color** — consistent across every screen
- **Breadcrumb navigation** — user always knows where they are in hierarchy
- **One action = one screen** — Transfer has its own page, not a modal
- **Bilingual labels** — English primary, Hindi in parentheses for key terms
- **Mobile-first** — works on 360px phone screen (Chrome on Android)

### 6.2 Navigation Structure

```
Sidebar (collapsible on mobile):
  🏠 Dashboard
  🚐 Vehicles
  👤 Drivers
  🔄 Transfers          ← recent transfers quick view
  🔔 Alerts
  📊 Reports
  ⚙️  Admin             ← visible to Super Admin only
```

**Top bar:** Shows current user's scope — e.g. "Circle: Barabanki" or "All Circles" for HQ.

### 6.3 Status Badge Colors

```
Active          →  bg-green-100   text-green-800
Maintenance     →  bg-yellow-100  text-yellow-800
Breakdown       →  bg-red-100     text-red-800
Removed         →  bg-gray-200    text-gray-600
Standby         →  bg-blue-100    text-blue-800
Accident        →  bg-red-200     text-red-900
```

### 6.4 Document Expiry Colors

```
> 30 days         →  🟢 Green text
≤ 30 days         →  🟡 Yellow text + bell icon
Expired           →  🔴 Red text + alert icon + row highlight
```

### 6.5 Speed Optimizations

- Static Next.js shell → dashboard loads in < 300ms
- TanStack Table virtual rows for 100+ vehicle lists
- Supabase indexes on `circle_id`, `division_id`, `vehicle_id`, `status`
- SWR caching: stale data shown instantly, refreshed in background
- Cascading dropdowns use prefetched lookup data (circles/divisions/substations loaded once on login)
- Pagination: 25 rows per page default

---

## 7. Development Phases

### Phase 1 — MVP (5–7 weeks)

- [ ] Supabase project setup + full schema migration
- [ ] Auth with role-based RLS policies
- [ ] Hierarchy master (Circles, Divisions, Substations) — Admin seeded
- [ ] Vehicle Master CRUD (with circle linkage)
- [ ] Current Assignment + Transfer flow (including cross-circle)
- [ ] Driver Master + Shift Assignment
- [ ] Vehicle Profile page (all 6 tabs)
- [ ] Dashboard (company-wide + circle-scoped views)
- [ ] Alerts page

### Phase 2 — Enhanced (3–4 weeks)

- [ ] Document upload + preview (Supabase Storage)
- [ ] Reports + Excel export
- [ ] WhatsApp/email alerts on doc expiry (Supabase Edge Functions + WAHA)
- [ ] Audit log table (who changed what, when)
- [ ] Advanced search across circles

### Phase 3 — Future

- [ ] Android app (Flutter) — same Supabase backend, zero backend rework
- [ ] Bulk import from Excel (initial data migration tool)
- [ ] GPS device live status API integration
- [ ] Cross-circle analytics dashboard

---

## 8. Initial Data Migration Plan

1. Prepare **Excel template** with columns matching Vehicle Master (including Circle column)
2. Data entry by Division Incharges into template
3. **Bulk insert script** (Python/Node) reads Excel → inserts into Supabase with correct hierarchy IDs
4. Each Circle Incharge verifies their circle's data on web portal
5. Go-live circle by circle (Barabanki first, then roll out)

---

## 9. Folder Structure (Next.js App Router)

```
frt-vms/
├── app/
│   ├── (auth)/login/
│   ├── dashboard/
│   ├── vehicles/
│   │   ├── page.tsx                  ← Vehicle list (multi-circle filterable)
│   │   ├── new/page.tsx
│   │   └── [id]/
│   │       ├── page.tsx              ← Vehicle profile
│   │       └── transfer/page.tsx
│   ├── drivers/
│   ├── transfers/                    ← Recent transfers view
│   ├── alerts/
│   ├── reports/
│   └── admin/
│       ├── page.tsx
│       ├── circles/
│       ├── divisions/
│       ├── substations/
│       └── users/
├── components/
│   ├── ui/                           ← shadcn components
│   ├── vehicles/
│   ├── drivers/
│   ├── dashboard/
│   │   ├── CircleBreakdownTable.tsx
│   │   ├── SummaryCards.tsx
│   │   └── ActivityFeed.tsx
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── ExpiryBadge.tsx
│       ├── Timeline.tsx
│       ├── HierarchySelect.tsx       ← cascading Circle→Division→Substation picker
│       └── DataTable.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts                  ← Supabase generated types
│   ├── hooks/
│   │   ├── useCircles.ts
│   │   ├── useDivisions.ts
│   │   └── useSubstations.ts
│   └── utils/
│       ├── expiry.ts
│       └── export.ts
└── supabase/
    └── migrations/
        ├── 001_hierarchy.sql
        ├── 002_vehicles.sql
        ├── 003_drivers.sql
        ├── 004_assignments.sql
        └── 005_rls_policies.sql
```

---

## 10. Environment Setup

```bash
# Create project
npx create-next-app@latest frt-vms --typescript --tailwind --app
cd frt-vms

# UI components
npx shadcn-ui@latest init

# Dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install zustand react-hook-form zod @hookform/resolvers
npm install @tanstack/react-table recharts lucide-react
npm install date-fns xlsx swr

# Supabase CLI
npm install -g supabase
supabase login
supabase init
supabase link --project-ref YOUR_PROJECT_REF

# Generate TS types from schema
supabase gen types typescript --local > lib/supabase/types.ts
```

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

---

## 11. Key SQL Queries Reference

```sql
-- Company-wide deployment view
SELECT
  c.name AS circle,
  d.name AS division,
  s.name AS substation,
  v.registration_no,
  v.status,
  v.owner_name,
  va.assigned_from
FROM vehicles v
JOIN vehicle_assignments va ON va.vehicle_id = v.id
JOIN substations s ON s.id = va.substation_id
JOIN divisions d ON d.id = va.division_id
JOIN circles c ON c.id = va.circle_id
WHERE v.status != 'removed'
ORDER BY c.name, d.name, s.name;

-- Circle-wise fleet summary for dashboard
SELECT
  c.name AS circle,
  COUNT(*) FILTER (WHERE v.status = 'active') AS active,
  COUNT(*) FILTER (WHERE v.status = 'maintenance') AS maintenance,
  COUNT(*) FILTER (WHERE v.status = 'breakdown') AS breakdown,
  COUNT(*) AS total
FROM vehicles v
JOIN circles c ON c.id = v.circle_id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Transfer history for one vehicle (with full hierarchy, newest first)
SELECT
  vth.transfer_date,
  vth.is_cross_circle,
  fc.name AS from_circle,
  fs.name AS from_substation,
  tc.name AS to_circle,
  ts.name AS to_substation,
  vth.reason,
  vth.approved_by
FROM vehicle_transfer_history vth
LEFT JOIN circles fc ON fc.id = vth.from_circle_id
LEFT JOIN substations fs ON fs.id = vth.from_substation_id
LEFT JOIN circles tc ON tc.id = vth.to_circle_id
LEFT JOIN substations ts ON ts.id = vth.to_substation_id
WHERE vth.vehicle_id = $1
ORDER BY vth.transfer_date DESC;

-- Documents expiring in 30 days (with circle info)
SELECT
  c.name AS circle,
  v.registration_no,
  v.insurance_expiry,
  v.fitness_expiry,
  v.pollution_expiry
FROM vehicles v
JOIN circles c ON c.id = v.circle_id
WHERE v.status = 'active'
  AND (
    v.insurance_expiry <= CURRENT_DATE + 30
    OR v.fitness_expiry <= CURRENT_DATE + 30
    OR v.pollution_expiry <= CURRENT_DATE + 30
  )
ORDER BY c.name, LEAST(v.insurance_expiry, v.fitness_expiry, v.pollution_expiry);

-- Current 3-shift drivers for a vehicle
SELECT
  da.shift,
  dr.name,
  dr.mobile,
  dr.license_no,
  da.from_date
FROM driver_assignments da
JOIN drivers dr ON dr.id = da.driver_id
WHERE da.vehicle_id = $1
  AND da.to_date IS NULL
ORDER BY da.shift;
```

---

## 12. Estimated Cost

| Service | Free Tier Limit | Estimated Usage (Multi-Circle) | Cost |
|---|---|---|---|
| Vercel | 100GB bandwidth/month | ~5GB/month | ₹0 |
| Supabase Free | 500MB DB, 2 cores | Sufficient up to ~5 circles | ₹0 |
| Supabase Pro (if needed) | 8GB DB, 4 cores | For 10+ circles, heavy usage | ~₹1,700/month |
| Domain | — | frt-vms.imperialelectric.in | ~₹800/year |
| **Phase 1 Total** | | Up to ~5 circles | **₹0 – ₹800/year** |

---

*Document end. Version 2.0 — The Imperial Electric Company, Multi-Circle FRT-VMS.*
