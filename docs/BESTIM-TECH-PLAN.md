# Bestim — Technical Plan & Claude Code Blueprint

> Vehicle & machine maintenance tracking app. Arabic-first, bilingual (AR/EN), mobile-native.
> This document is the single source of truth for Claude Code to scaffold and build the entire project.

---

## 1. Product Overview

**Bestim** (بستيم) is a mobile app that helps vehicle and machine owners track maintenance, log service records (by voice or manually), manage reminders, and monitor expenses. It supports Arabic (RTL) and English (LTR) from day one.

### Core Value Props
- Voice-powered maintenance logging (speak what you did, AI extracts structured data)
- Trustworthy service history with correction tracking
- Smart reminders based on mileage and time
- Expense tracking with charts
- Vehicle history sharing (for resale)

---

## 2. Tech Stack (All Free Tier)

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Expo SDK 57 + React Native | Latest stable. Managed workflow, no native config needed |
| **Language** | TypeScript (strict) | Type safety across the app |
| **Routing** | Expo Router v4 (file-based) | Next.js-style routing, Shady's comfort zone |
| **Styling** | NativeWind v4 (Tailwind CSS) | Utility-first, matches Shady's Tailwind skills |
| **State (client)** | Zustand | Lightweight, no boilerplate, great RN support |
| **State (server)** | TanStack Query v5 | Caching, background sync, optimistic updates |
| **Backend** | Supabase (existing project) | Auth, PostgreSQL, Storage, Edge Functions, Realtime |
| **Auth** | Supabase Auth | Email/password + Google OAuth + Apple Sign-In (iOS) |
| **Database** | Supabase PostgreSQL | Row Level Security, real-time subscriptions |
| **Storage** | Supabase Storage | Vehicle photos, receipt images |
| **Push Notifications** | Expo Notifications | Free push via Expo's service |
| **i18n** | i18next + react-i18next | Industry standard, RTL support, namespace splitting |
| **Voice (frontend)** | expo-speech-recognition | On-device speech-to-text, free |
| **Voice (backend)** | Partner's Supabase Edge Function | Will be integrated when ready — just call the API |
| **Charts** | react-native-chart-kit | Lightweight, free, SVG-based |
| **Icons** | lucide-react-native | Matches the Figma design exactly (same 37 icons) |
| **Fonts** | expo-font | Tajawal (Arabic) + Poppins (Latin/numbers) |
| **Forms** | react-hook-form + zod | Validation with zero re-renders |
| **Date/Time** | date-fns | Lightweight, tree-shakeable |
| **Local Storage** | @react-native-async-storage/async-storage | Offline caching, user preferences |
| **Animations** | react-native-reanimated | Smooth 60fps native animations |
| **Build** | EAS Build (free tier) | 30 builds/month on free plan |
| **OTA Updates** | EAS Update (free tier) | Push JS updates without app store review |
| **Dev Testing** | Expo Go | Scan QR, test on real device instantly |

### Key Version Pins

```json
{
  "expo": "~57.0.0",
  "react-native": "0.79.x",
  "react": "19.x",
  "nativewind": "^4.0.0",
  "expo-router": "~4.0.0",
  "tailwindcss": "^3.4.0",
  "@supabase/supabase-js": "^2.45.0",
  "zustand": "^5.0.0",
  "@tanstack/react-query": "^5.60.0",
  "i18next": "^24.0.0",
  "react-i18next": "^15.0.0",
  "react-hook-form": "^7.54.0",
  "zod": "^3.23.0",
  "lucide-react-native": "^0.460.0",
  "date-fns": "^4.0.0",
  "react-native-reanimated": "~3.16.0"
}
```

---

## 3. Project Structure

```
bestim/
├── app/                          # Expo Router file-based routes
│   ├── _layout.tsx               # Root layout (providers, fonts, i18n init)
│   ├── index.tsx                 # Splash → check auth → redirect
│   │
│   ├── (auth)/                   # Auth group (no bottom tabs)
│   │   ├── _layout.tsx           # Stack navigator
│   │   ├── language.tsx          # Screen 1: Language picker
│   │   ├── welcome.tsx           # Screen 2: Welcome / hero
│   │   ├── login.tsx             # Screen 30: Sign in
│   │   ├── register.tsx          # Screen 31: Sign up
│   │   ├── profile-setup.tsx     # Screen 32: Name & photo
│   │   ├── forgot-password.tsx   # Screen 49: Forgot password
│   │   └── verify-email.tsx      # Screen 50: Check your email
│   │
│   ├── (onboarding)/             # Post-auth onboarding (no tabs)
│   │   ├── _layout.tsx           # Stack navigator
│   │   ├── tour-voice.tsx        # Screen 33: Tour / voice
│   │   ├── tour-reminders.tsx    # Screen 34: Tour / reminders
│   │   ├── tour-history.tsx      # Screen 35: Tour / history
│   │   ├── add-vehicle.tsx       # Screen 3: Vehicle data
│   │   ├── add-odometer.tsx      # Screen 4: Odometer reading
│   │   └── first-log.tsx         # Screen 5: First maintenance log
│   │
│   ├── (tabs)/                   # Main app with bottom navigation
│   │   ├── _layout.tsx           # Tab navigator (5 tabs)
│   │   │
│   │   ├── (home)/               # Tab 1: Home
│   │   │   ├── _layout.tsx       # Stack
│   │   │   ├── index.tsx         # Screen 6/7: Home (today / empty)
│   │   │   └── guest.tsx         # Screen 36: Guest home
│   │   │
│   │   ├── (vehicles)/           # Tab 2: My vehicles
│   │   │   ├── _layout.tsx       # Stack
│   │   │   ├── index.tsx         # Screen 8: Vehicle list
│   │   │   ├── [id].tsx          # Screen 9: Vehicle details
│   │   │   ├── part/[id].tsx     # Screen 11: Part details (oil etc.)
│   │   │   └── part-history.tsx  # Screen 12: Part replacement history
│   │   │
│   │   ├── (capture)/            # Tab 3: Log maintenance (center button)
│   │   │   ├── _layout.tsx       # Stack (modal presentation)
│   │   │   ├── index.tsx         # Screen 13: Choose method (voice/manual)
│   │   │   ├── voice.tsx         # Screen 14: Voice recording
│   │   │   ├── clarify.tsx       # Screen 17: AI clarification
│   │   │   ├── review.tsx        # Screen 15: Review before save
│   │   │   └── manual.tsx        # Screen 16: Manual entry form
│   │   │
│   │   ├── (reminders)/          # Tab 4: Reminders
│   │   │   ├── _layout.tsx       # Stack
│   │   │   ├── index.tsx         # Screen 21/38: Reminders list / empty
│   │   │   ├── [id].tsx          # Screen 22: Reminder detail
│   │   │   └── update-odometer.tsx # Screen 25: Update odometer
│   │   │
│   │   └── (account)/            # Tab 5: Account
│   │       ├── _layout.tsx       # Stack
│   │       ├── index.tsx         # Screen 26: Account & settings
│   │       ├── notifications.tsx # Screen 28: Notification prefs
│   │       ├── export.tsx        # Screen 27: Export history
│   │       ├── share.tsx         # Screen 41: Share vehicle history
│   │       └── receive.tsx       # Screen 42: Receive vehicle history
│   │
│   └── (modals)/                 # Full-screen modals
│       ├── maintenance-log.tsx   # Screen 10/39: Maintenance history
│       ├── log-detail.tsx        # Screen 18: Verified log detail
│       ├── corrections.tsx       # Screen 19: Correction history
│       ├── review-reading.tsx    # Screen 20: Reading needs review
│       ├── expenses.tsx          # Screen 23/40: Expenses / empty
│       ├── add-expense.tsx       # Screen 24: Add expense
│       └── feature-gate.tsx      # Screen 37: Feature requires account
│
├── components/                   # Shared UI components
│   ├── ui/                       # Base design system
│   │   ├── Button.tsx            # Primary, secondary, dark, danger
│   │   ├── Field.tsx             # Text input with label
│   │   ├── Card.tsx              # Elevated card wrapper
│   │   ├── Item.tsx              # List item with icon + chevron
│   │   ├── Header.tsx            # Screen header with back button
│   │   ├── Note.tsx              # Info/warning note box
│   │   ├── Metric.tsx            # Big number tile
│   │   ├── Choice.tsx            # Segmented control / pill tabs
│   │   ├── Toggle.tsx            # Setting toggle switch
│   │   ├── Divider.tsx           # "or" divider with lines
│   │   ├── Progress.tsx          # Step progress bar
│   │   ├── StatusBar.tsx         # Themed status bar wrapper
│   │   └── BottomNav.tsx         # Bottom tab bar (custom)
│   │
│   ├── illustrations/            # Custom art components
│   │   ├── CarIllustration.tsx
│   │   ├── VoiceWave.tsx
│   │   ├── GaugeRing.tsx
│   │   ├── CalendarCard.tsx
│   │   └── HistoryCard.tsx
│   │
│   ├── forms/                    # Form-specific components
│   │   ├── VehicleForm.tsx
│   │   ├── MaintenanceForm.tsx
│   │   └── ExpenseForm.tsx
│   │
│   └── feedback/                 # Confirmation / error screens
│       ├── SuccessSheet.tsx      # Screen 43/44: Success overlays
│       ├── PermissionSheet.tsx   # Screen 45: Notification permission
│       ├── ConfirmSheet.tsx      # Screen 46: Delete confirmation
│       ├── OfflineBanner.tsx     # Screen 47: Offline state
│       └── ErrorState.tsx        # Screen 48: Load failure
│
├── lib/                          # Core utilities
│   ├── supabase.ts               # Supabase client init
│   ├── auth.ts                   # Auth helpers (signIn, signUp, social)
│   ├── i18n.ts                   # i18next config + language detection
│   ├── theme.ts                  # Color tokens + dark mode
│   └── constants.ts              # App-wide constants
│
├── hooks/                        # Custom React hooks
│   ├── useAuth.ts                # Auth state + session management
│   ├── useVehicles.ts            # Vehicle CRUD with TanStack Query
│   ├── useLogs.ts                # Maintenance log queries
│   ├── useReminders.ts           # Reminder queries
│   ├── useExpenses.ts            # Expense queries
│   ├── useVoice.ts               # Speech-to-text hook
│   ├── useOnboarding.ts          # Onboarding flow state
│   └── useNetwork.ts             # Online/offline detection
│
├── stores/                       # Zustand stores
│   ├── authStore.ts              # User session, profile
│   ├── vehicleStore.ts           # Selected vehicle, local cache
│   ├── settingsStore.ts          # Language, notifications, theme
│   └── onboardingStore.ts        # Tour completion flags
│
├── services/                     # API layer
│   ├── vehicles.ts               # Vehicle CRUD operations
│   ├── logs.ts                   # Maintenance log operations
│   ├── reminders.ts              # Reminder CRUD
│   ├── expenses.ts               # Expense CRUD
│   ├── voice.ts                  # Voice API (partner's function)
│   ├── sharing.ts                # Vehicle history share/receive
│   └── export.ts                 # PDF/CSV export
│
├── locales/                      # Translation files
│   ├── ar/
│   │   ├── common.json           # Shared strings
│   │   ├── auth.json             # Auth flow strings
│   │   ├── vehicles.json         # Vehicle strings
│   │   ├── logs.json             # Maintenance log strings
│   │   ├── reminders.json        # Reminder strings
│   │   ├── expenses.json         # Expense strings
│   │   └── settings.json         # Settings strings
│   └── en/
│       ├── common.json
│       ├── auth.json
│       ├── vehicles.json
│       ├── logs.json
│       ├── reminders.json
│       ├── expenses.json
│       └── settings.json
│
├── assets/                       # Static assets
│   ├── fonts/
│   │   ├── Tajawal-Regular.ttf
│   │   ├── Tajawal-Bold.ttf
│   │   └── Poppins-Bold.ttf
│   ├── images/
│   │   ├── logo-icon-dark.png
│   │   ├── logo-icon-inverse.png
│   │   ├── logo-word-dark.png
│   │   └── logo-word-inverse.png
│   └── splash.png
│
├── types/                        # TypeScript type definitions
│   ├── database.ts               # Generated from Supabase (or manual)
│   ├── navigation.ts             # Route params
│   └── api.ts                    # API request/response types
│
├── tailwind.config.js            # NativeWind + Bestim tokens
├── nativewind-env.d.ts           # NativeWind type declarations
├── app.json                      # Expo config
├── tsconfig.json
├── babel.config.js
└── package.json
```

---

## 4. Design Tokens (from Figma)

These MUST be applied exactly as specified — they match the Figma design file 1:1.

### Colors

```js
// tailwind.config.js extend.colors
const colors = {
  // Light theme
  lime:   '#D3F53D',  // Primary accent, CTAs, active states
  ink:    '#222E29',  // Primary text, dark surfaces
  teal:   '#08736F',  // Secondary accent, links
  paper:  '#F5F7F5',  // Page background
  white:  '#FFFFFF',  // Card backgrounds
  muted:  '#5B6860',  // Secondary text
  line:   '#DEE5DF',  // Borders, dividers, inactive
  coral:  '#F96A83',  // Warning accent
  blush:  '#FFE5EB',  // Warning background
  sky:    '#DDEBFF',  // Info background
  mint:   '#E4F3D9',  // Success background, notes
  amber:  '#FFF0CE',  // Alert background
  danger: '#AC2846',  // Error, destructive actions
  board:  '#E8EDE8',  // Canvas background (not used in app)
};

// Dark theme overrides
const darkColors = {
  lime:   '#D3F53D',
  ink:    '#F5F7F5',  // Inverted for readability
  teal:   '#2EC4B6',
  paper:  '#0D1410',
  white:  '#1A2420',
  muted:  '#8A9B91',
  line:   '#2A3830',
  coral:  '#FF8FA3',
  blush:  '#3D1F28',
  sky:    '#1A2840',
  mint:   '#1A3020',
  amber:  '#3D3010',
  danger: '#FF4D6A',
  board:  '#0D1410',
};
```

### Typography

```js
// Font families
const fonts = {
  arabic: 'Tajawal',       // All Arabic text
  latin:  'Poppins',        // Numbers, English text
};

// Type scale (size / lineHeight / weight)
const typography = {
  display:     { size: 36, line: 46, weight: '700' },   // Hero headlines
  title:       { size: 28, line: 38, weight: '700' },   // Section titles
  heading:     { size: 20, line: 28, weight: '700' },   // Card headers
  body:        { size: 16, line: 24, weight: '400' },   // Body text
  label:       { size: 16, line: 24, weight: '700' },   // Button labels, item titles
  caption:     { size: 13, line: 20, weight: '400' },   // Secondary text
  number:      { size: 36, line: 44, weight: '700' },   // Big metrics (Poppins)
  smallNumber: { size: 24, line: 32, weight: '700' },   // Small metrics (Poppins)
};
```

### Spacing & Radii

```
Screen:           390 × 844 (iPhone 14 Pro)
Content padding:  24px horizontal
Component gap:    14px vertical
Card radius:      18px (items), 14px (buttons, fields, notes), 20px (metrics)
Screen radius:    32px (for nav bar corners)
Bottom nav:       28px radius, 68px height, positioned at y=748
Status bar:       48px height
```

### Shadows (fx system)

```js
const shadows = {
  card:     '0 4px 16px rgba(0,0,0,0.06)',
  soft:     '0 2px 8px rgba(0,0,0,0.04)',
  elevated: '0 8px 24px -2px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.04)',
  glow:     '0 6px 16px -2px rgba(211,245,61,0.35)',  // Lime glow for primary buttons
  nav:      '0 -4px 20px -2px rgba(0,0,0,0.16)',       // Bottom nav upward shadow
  field:    'inset 0 1px 3px rgba(0,0,0,0.05)',         // Input field inner shadow
};
```

---

## 5. Supabase Database Schema

### Tables

```sql
-- Enable RLS on all tables
-- All timestamps in UTC

-- ─── User Profile (extends Supabase auth.users) ────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  language TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Vehicles ───────────────────────────────────────────────
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  make TEXT NOT NULL,                    -- e.g. 'Toyota'
  model TEXT NOT NULL,                   -- e.g. 'Camry'
  year INTEGER NOT NULL,                 -- e.g. 2022
  plate_number TEXT,                     -- e.g. 'أ ب ج ١٢٣٤'
  color TEXT,
  vin TEXT,                              -- Vehicle Identification Number
  current_odometer INTEGER NOT NULL DEFAULT 0,  -- in km
  odometer_unit TEXT NOT NULL DEFAULT 'km' CHECK (odometer_unit IN ('km', 'mi')),
  photo_url TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Service Types ──────────────────────────────────────────
CREATE TABLE public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,                 -- e.g. 'تغيير الزيت'
  name_en TEXT NOT NULL,                 -- e.g. 'Oil Change'
  icon TEXT NOT NULL DEFAULT 'Wrench',   -- Lucide icon name
  category TEXT NOT NULL DEFAULT 'maintenance',  -- maintenance, repair, inspection
  default_interval_km INTEGER,           -- e.g. 5000
  default_interval_months INTEGER,       -- e.g. 6
  is_system BOOLEAN NOT NULL DEFAULT true  -- system-defined vs user-created
);

-- ─── Maintenance Logs ───────────────────────────────────────
CREATE TABLE public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES public.service_types(id),
  title TEXT NOT NULL,                   -- e.g. 'تغيير زيت المحرك'
  description TEXT,
  odometer_reading INTEGER,
  cost DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'EGP',
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,                         -- Workshop name/address
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'voice')),
  voice_transcript TEXT,                 -- Original voice text if source='voice'
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'needs_review', 'corrected')),
  parts_replaced JSONB DEFAULT '[]',     -- [{name, brand, part_number, cost}]
  photos TEXT[] DEFAULT '{}',            -- Array of storage URLs
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Log Corrections (audit trail) ─────────────────────────
CREATE TABLE public.log_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES public.maintenance_logs(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,              -- Which field was corrected
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  corrected_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- ─── Reminders ──────────────────────────────────────────────
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES public.service_types(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,                         -- Time-based trigger
  due_odometer INTEGER,                  -- Mileage-based trigger
  repeat_interval_km INTEGER,            -- Auto-repeat every N km
  repeat_interval_months INTEGER,        -- Auto-repeat every N months
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due', 'overdue', 'completed', 'dismissed')),
  notify_before_days INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Expenses ───────────────────────────────────────────────
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_id UUID REFERENCES public.maintenance_logs(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'maintenance' CHECK (category IN ('maintenance', 'fuel', 'insurance', 'registration', 'parking', 'other')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Vehicle Shares ─────────────────────────────────────────
CREATE TABLE public.vehicle_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES public.profiles(id),
  shared_with_email TEXT,                -- Email of recipient
  share_token TEXT UNIQUE NOT NULL,      -- Unique token for claiming
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  includes_expenses BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────
CREATE INDEX idx_vehicles_user ON public.vehicles(user_id);
CREATE INDEX idx_logs_vehicle ON public.maintenance_logs(vehicle_id);
CREATE INDEX idx_logs_user ON public.maintenance_logs(user_id);
CREATE INDEX idx_logs_date ON public.maintenance_logs(service_date DESC);
CREATE INDEX idx_reminders_vehicle ON public.reminders(vehicle_id);
CREATE INDEX idx_reminders_status ON public.reminders(status);
CREATE INDEX idx_expenses_vehicle ON public.expenses(vehicle_id);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX idx_shares_token ON public.vehicle_shares(share_token);
```

### Row Level Security Policies

```sql
-- Profiles: users can only read/update their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Vehicles: users can only access their own
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own vehicles" ON public.vehicles FOR ALL USING (auth.uid() = user_id);

-- Maintenance logs: users can only access their own
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own logs" ON public.maintenance_logs FOR ALL USING (auth.uid() = user_id);

-- Apply similar policies to all other tables...
ALTER TABLE public.log_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own corrections" ON public.log_corrections FOR ALL USING (auth.uid() = corrected_by);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.vehicle_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own shares" ON public.vehicle_shares FOR ALL USING (auth.uid() = shared_by);
CREATE POLICY "Anyone can view share by token" ON public.vehicle_shares FOR SELECT USING (true);
```

### Seed Data — Service Types

```sql
INSERT INTO public.service_types (name_ar, name_en, icon, category, default_interval_km, default_interval_months) VALUES
  ('تغيير الزيت', 'Oil Change', 'Droplets', 'maintenance', 5000, 6),
  ('فلتر الهواء', 'Air Filter', 'Wind', 'maintenance', 15000, 12),
  ('فلتر الزيت', 'Oil Filter', 'Filter', 'maintenance', 5000, 6),
  ('فحص الفرامل', 'Brake Inspection', 'CircleAlert', 'inspection', 20000, 12),
  ('تغيير تيل الفرامل', 'Brake Pad Replacement', 'Disc', 'maintenance', 40000, NULL),
  ('تبديل الإطارات', 'Tire Rotation', 'RefreshCcw', 'maintenance', 10000, 6),
  ('تغيير الإطارات', 'Tire Replacement', 'Circle', 'maintenance', 50000, NULL),
  ('فحص البطارية', 'Battery Check', 'BatteryFull', 'inspection', NULL, 6),
  ('تغيير البطارية', 'Battery Replacement', 'BatteryCharging', 'maintenance', NULL, 36),
  ('فحص سائل التبريد', 'Coolant Check', 'Thermometer', 'inspection', 30000, 12),
  ('تغيير شمعات الاحتراق', 'Spark Plug Replacement', 'Zap', 'maintenance', 30000, NULL),
  ('فحص ناقل الحركة', 'Transmission Check', 'Settings', 'inspection', 60000, 24),
  ('غسيل السيارة', 'Car Wash', 'Sparkles', 'maintenance', NULL, 1),
  ('فحص دوري شامل', 'Full Inspection', 'ClipboardCheck', 'inspection', 20000, 12),
  ('تغيير مساحات الزجاج', 'Wiper Replacement', 'CloudRain', 'maintenance', NULL, 12),
  ('فحص التكييف', 'AC Service', 'Snowflake', 'inspection', NULL, 12),
  ('تغيير سير التوقيت', 'Timing Belt', 'Timer', 'maintenance', 100000, NULL),
  ('إصلاح عام', 'General Repair', 'Wrench', 'repair', NULL, NULL);
```

### Database Trigger — Auto-create Profile

```sql
-- Automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 6. Auth Flow

### Email/Password
1. User enters email + password on register screen
2. `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
3. Profile auto-created by trigger
4. Redirect to onboarding tour

### Google OAuth
1. Use `@react-native-google-signin/google-signin` for native Google sign-in
2. Get `idToken` from Google
3. `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`
4. Works on both iOS and Android

### Apple Sign-In (iOS only)
1. Use `expo-apple-authentication`
2. Get `identityToken` from Apple
3. `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken })`
4. Only show Apple button on iOS (`Platform.OS === 'ios'`)

### Forgot Password
1. `supabase.auth.resetPasswordForEmail(email)`
2. Show "check your email" screen
3. Deep link back to app with reset token

### Guest Mode
1. No auth — limited home screen (Screen 36)
2. Feature gate modal (Screen 37) on protected actions
3. "Sign up" CTA redirects to auth flow

### Session Management
- Store session in `@react-native-async-storage/async-storage`
- Auto-refresh via `supabase.auth.onAuthStateChange()`
- Zustand `authStore` holds current user + profile

---

## 7. i18n Setup

### Configuration

```typescript
// lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import all translation files
import arCommon from '@/locales/ar/common.json';
import enCommon from '@/locales/en/common.json';
// ... other namespaces

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    ar: { common: arCommon, /* ... */ },
    en: { common: enCommon, /* ... */ },
  },
  lng: 'ar',  // Default
  fallbackLng: 'ar',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});
```

### RTL Handling

```typescript
// In root _layout.tsx
import { I18nManager } from 'react-native';

useEffect(() => {
  const isRTL = i18n.language === 'ar';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
    // Requires app restart — use expo-updates or show restart prompt
  }
}, [i18n.language]);
```

### Language Persistence

- Save chosen language to AsyncStorage AND to `profiles.language` in Supabase
- On app launch: check AsyncStorage first (instant), then sync with server

---

## 8. Voice Logging Architecture

### Frontend Flow
1. User taps "بصوتي" (By voice) on Screen 13
2. `expo-speech-recognition` starts listening
3. Show live waveform animation (Screen 14)
4. User taps stop → raw transcript captured
5. Send transcript to partner's Supabase Edge Function
6. Receive structured data back: `{ service_type, parts, cost, odometer, notes }`
7. Show pre-filled review screen (Screen 15) for confirmation
8. If AI needs clarification → Screen 17
9. User confirms → save to `maintenance_logs`

### Integration Point (Partner's Function)

```typescript
// services/voice.ts
export async function processVoiceLog(transcript: string, vehicleId: string) {
  const { data, error } = await supabase.functions.invoke('process-voice-log', {
    body: { transcript, vehicle_id: vehicleId },
  });
  // Returns: { service_type, parts[], cost, odometer, notes, needs_clarification, questions[] }
  return data;
}
```

> **NOTE**: The backend Edge Function is being built by Shady's partner.
> For now, build the complete frontend (recording UI, waveform, review screen)
> and mock the API response. The real function will be plugged in later.

---

## 9. Screen Map (50 Screens → Routes)

| ID | Arabic Name | English Name | Route | Journey |
|---|---|---|---|---|
| 29 | البداية | Splash | `index` | 01 Welcome |
| 1 | اختيار اللغة | Language Picker | `(auth)/language` | 01 Welcome |
| 2 | مرحباً بك | Welcome | `(auth)/welcome` | 01 Welcome |
| 30 | تسجيل الدخول | Sign In | `(auth)/login` | 01 Welcome |
| 31 | إنشاء حساب | Sign Up | `(auth)/register` | 01 Welcome |
| 32 | ملفك الشخصي | Profile Setup | `(auth)/profile-setup` | 01 Welcome |
| 49 | نسيت كلمة المرور | Forgot Password | `(auth)/forgot-password` | 01 Welcome |
| 50 | تحقّق من بريدك | Verify Email | `(auth)/verify-email` | 01 Welcome |
| 33 | جولة / الصوت | Tour: Voice | `(onboarding)/tour-voice` | 02 Quick Tour |
| 34 | جولة / المواعيد | Tour: Reminders | `(onboarding)/tour-reminders` | 02 Quick Tour |
| 35 | جولة / السجل | Tour: History | `(onboarding)/tour-history` | 02 Quick Tour |
| 3 | إضافة سيارة / البيانات | Add Vehicle: Data | `(onboarding)/add-vehicle` | 03 First Car |
| 4 | إضافة سيارة / العداد | Add Vehicle: Odometer | `(onboarding)/add-odometer` | 03 First Car |
| 5 | إضافة سيارة / أول سجل | Add Vehicle: First Log | `(onboarding)/first-log` | 03 First Car |
| 7 | الرئيسية / البداية | Home: Empty | `(tabs)/(home)/index` | 03 First Car |
| 6 | الرئيسية / سيارتي اليوم | Home: Today | `(tabs)/(home)/index` | 03 First Car |
| 36 | الرئيسية / زائر | Home: Guest | `(tabs)/(home)/guest` | 04 Guest Browse |
| 37 | ميزة تتطلب حساباً | Feature Gate | `(modals)/feature-gate` | 04 Guest Browse |
| 13 | اختر طريقة التسجيل | Choose Method | `(tabs)/(capture)/index` | 05 Log Work |
| 14 | التسجيل بالصوت | Voice Recording | `(tabs)/(capture)/voice` | 05 Log Work |
| 17 | توضيح معلومة | AI Clarification | `(tabs)/(capture)/clarify` | 05 Log Work |
| 15 | مراجعة قبل الحفظ | Review Before Save | `(tabs)/(capture)/review` | 05 Log Work |
| 16 | إدخال سجل يدوياً | Manual Entry | `(tabs)/(capture)/manual` | 05 Log Work |
| 21 | مواعيد الصيانة | Reminders | `(tabs)/(reminders)/index` | 06 Reminders |
| 22 | تفاصيل موعد الصيانة | Reminder Detail | `(tabs)/(reminders)/[id]` | 06 Reminders |
| 25 | تحديث العداد | Update Odometer | `(tabs)/(reminders)/update-odometer` | 06 Reminders |
| 38 | المواعيد / فارغة | Reminders: Empty | `(tabs)/(reminders)/index` | 06 Reminders |
| 10 | سجل الصيانة | Maintenance History | `(modals)/maintenance-log` | 07 History |
| 18 | تفاصيل سجل موثّق | Verified Log Detail | `(modals)/log-detail` | 07 History |
| 19 | سجل التصحيحات | Correction History | `(modals)/corrections` | 07 History |
| 20 | قراءة تحتاج مراجعة | Needs Review | `(modals)/review-reading` | 07 History |
| 39 | سجل الصيانة / فارغ | History: Empty | `(modals)/maintenance-log` | 07 History |
| 8 | سياراتي ومعداتي | My Vehicles | `(tabs)/(vehicles)/index` | 08 Vehicles |
| 9 | تفاصيل السيارة | Vehicle Details | `(tabs)/(vehicles)/[id]` | 08 Vehicles |
| 11 | تفاصيل قطعة / الزيت | Part Detail: Oil | `(tabs)/(vehicles)/part/[id]` | 08 Vehicles |
| 12 | تاريخ القطع | Part History | `(tabs)/(vehicles)/part-history` | 08 Vehicles |
| 23 | المصاريف | Expenses | `(modals)/expenses` | 09 Expenses |
| 24 | إضافة مصروف | Add Expense | `(modals)/add-expense` | 09 Expenses |
| 40 | المصاريف / فارغة | Expenses: Empty | `(modals)/expenses` | 09 Expenses |
| 26 | حسابي والإعدادات | Account & Settings | `(tabs)/(account)/index` | 10 Account |
| 28 | تفضيلات التنبيهات | Notification Prefs | `(tabs)/(account)/notifications` | 10 Account |
| 27 | تصدير السجل | Export History | `(tabs)/(account)/export` | 10 Account |
| 41 | مشاركة تاريخ سيارة | Share History | `(tabs)/(account)/share` | 10 Account |
| 42 | استلام تاريخ سيارة | Receive History | `(tabs)/(account)/receive` | 10 Account |
| 43 | نجاح حفظ السجل | Log Saved Success | `SuccessSheet` component | 11 Feedback |
| 44 | نجاح إضافة السيارة | Vehicle Added Success | `SuccessSheet` component | 11 Feedback |
| 45 | إذن التنبيهات | Notification Permission | `PermissionSheet` component | 11 Feedback |
| 46 | تأكيد حذف السيارة | Delete Confirmation | `ConfirmSheet` component | 11 Feedback |
| 47 | الرئيسية / دون اتصال | Home: Offline | `OfflineBanner` component | 11 Feedback |
| 48 | تعذّر تحميل البيانات | Load Error | `ErrorState` component | 11 Feedback |

---

## 10. Bottom Tab Navigation

5 tabs matching the Figma design:

| Tab | Icon | Label (AR) | Label (EN) | Route Group |
|---|---|---|---|---|
| Home | `House` | الرئيسية | Home | `(home)` |
| Vehicles | `CarFront` | سياراتي | Vehicles | `(vehicles)` |
| Capture | `Plus` | سجّل | Log | `(capture)` |
| Reminders | `Bell` | المواعيد | Reminders | `(reminders)` |
| Account | `UserRound` | حسابي | Account | `(account)` |

The center "Capture" tab has a raised lime circle button (44px, lime background, ink icon), distinct from the other text-label tabs. The nav bar itself is ink-colored with 28px radius.

---

## 11. Lucide Icons Used (37 total)

These are the exact icons from the Figma design. Install `lucide-react-native` and import only these:

```
House, CarFront, Bell, UserRound, Plus, ChevronLeft, ChevronRight,
Mic, PencilLine, CalendarCheck, BadgeCheck, Wrench, Droplets, Wind,
Filter, CircleAlert, RefreshCcw, Circle, BatteryFull, BatteryCharging,
Thermometer, Zap, Settings, Sparkles, ClipboardCheck, CloudRain,
Snowflake, Timer, Signal, Wifi, Eye, EyeOff, Camera, Share2,
Download, Trash2, X
```

---

## 12. Build & Development Commands

```bash
# Initial setup
npx create-expo-app bestim --template tabs
cd bestim

# Install core dependencies
npx expo install expo-router expo-font expo-splash-screen expo-status-bar
npx expo install nativewind tailwindcss
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
npx expo install react-native-url-polyfill

# State & data
npm install zustand @tanstack/react-query

# i18n
npm install i18next react-i18next expo-localization

# Auth
npm install @react-native-google-signin/google-signin
npx expo install expo-apple-authentication

# Forms
npm install react-hook-form zod @hookform/resolvers

# UI
npm install lucide-react-native react-native-svg
npm install react-native-reanimated react-native-gesture-handler
npx expo install expo-haptics

# Voice
npx expo install expo-speech-recognition

# Charts
npm install react-native-chart-kit

# Utils
npm install date-fns

# Dev
npx expo start  # Development with Expo Go
npx eas build --platform ios --profile development  # iOS dev build
npx eas build --platform android --profile development  # Android dev build
```

---

## 13. Environment Variables

```env
# .env (git-ignored)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth (from Google Cloud Console — free)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

---

## 14. Development Priorities (Build Order)

### Phase 1 — Foundation (Week 1)
1. Project scaffold with Expo Router
2. NativeWind + design tokens (colors, typography, shadows)
3. Supabase client + auth (email/password)
4. i18n setup (AR + EN with RTL)
5. Base UI components (Button, Field, Card, Item, Header, Nav)
6. Root layout with providers

### Phase 2 — Auth & Onboarding (Week 2)
7. Language picker screen
8. Welcome screen with hero
9. Login / Register / Forgot Password screens
10. Google + Apple OAuth
11. Profile setup screen
12. Onboarding tour (3 screens)
13. Add vehicle flow (3 screens)

### Phase 3 — Core Features (Week 3-4)
14. Home screen (today view + empty + guest)
15. Vehicle list + detail screens
16. Part detail + history
17. Manual maintenance log entry
18. Voice recording UI (frontend only, mock API)
19. Review before save screen
20. Maintenance history list + detail
21. Correction tracking

### Phase 4 — Reminders & Expenses (Week 5)
22. Reminders list + detail
23. Update odometer screen
24. Expenses list + chart
25. Add expense form

### Phase 5 — Account & Polish (Week 6)
26. Account & settings screen
27. Notification preferences
28. Export history
29. Vehicle history sharing
30. Feedback screens (success, error, offline, permissions)
31. Push notifications integration
32. Offline support
33. Final QA and polish

---

## 15. Key Patterns

### Supabase Client Init

```typescript
// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

### Zustand Store Pattern

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    set({ user: data.user });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },
}));
```

### TanStack Query Pattern

```typescript
// hooks/useVehicles.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as vehicleService from '@/services/vehicles';

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleService.getAll,
  });
}

export function useAddVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: vehicleService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  });
}
```

---

## 16. Free Tier Limits to Watch

| Service | Free Tier | Limit |
|---|---|---|
| Supabase | Free plan | 500MB DB, 1GB storage, 2GB bandwidth, 50K monthly active users |
| EAS Build | Free plan | 30 builds/month (iOS + Android) |
| EAS Update | Free plan | 1,000 monthly updating users |
| Google Cloud (OAuth) | Always free | No cost for OAuth consent screen |
| Apple Developer | $99/year | Required for App Store + Apple Sign-In |
| Expo Push | Free | Unlimited push notifications |
| Google Fonts | Free | Tajawal + Poppins |

---

## 17. Notes for Claude Code

- **Always use `npx expo` commands**, never bare `react-native` CLI
- **NativeWind v4 uses `className` prop** — write Tailwind classes directly on RN components
- **RTL is built into React Native** — use `I18nManager.forceRTL()` and test both directions
- **Supabase types**: Generate with `npx supabase gen types typescript` or define manually in `types/database.ts`
- **The voice backend is NOT ready** — build the full voice UI but mock the API response
- **All screens are 390×844** — design for iPhone 14 Pro, use SafeAreaView
- **Bottom nav is custom** — don't use Expo Router's default tab bar, build the custom ink-colored nav from the design
- **Dark mode**: Support from day one using React Native's `useColorScheme()` + NativeWind dark: prefix
- **Arabic is the primary language** — all components should look correct in RTL first
- **Currency is EGP by default** but should be configurable per user
