# ⚔️ Goal Tracker — Gamified Life RPG

A **Progressive Web App** that turns your personal goals, habits and finances into a dark-fantasy RPG adventure. Complete milestones, earn XP, level up your Hero, and keep your budget under control — all in one place.

Live demo: **[goal-tracker-five-wheat.vercel.app](https://goal-tracker-five-wheat.vercel.app)**

---

## ✨ Features

### 🏰 Realm (Dashboard)
- XP summary with animated level badge
- Active quest count and weekly milestone recap
- Streak counter (consecutive days with ≥1 completed milestone)
- Quick-access to recent quests

### ⚔️ Quests (Goals)
- Create goals with title, description, priority, category, tags and target date
- Break goals into **milestones** — completing them earns XP and tracks progress
- Reminder system per quest: daily / weekly / monthly / custom weekdays
- Guide types: Finance, Weight, Habits — each with a dedicated tracker
- Share any quest as a URL template for others to import
- AI-style quest suggestions with pre-filled milestones

### 💎 Treasury (Finance / Kakeebo method)
- Set a monthly budget and track every expense
- Import directly from **ISYbank Excel exports** — parses the "Lista Operazioni" sheet, maps Italian categories automatically, skips income rows
- Donut chart breakdown by category with percentage bars
- **12-month spending trend** chart with month-over-month comparison
- **Category filter** in the daily log (tap a chip to show only that category)
- Insights: avg/day, biggest expense, active days, end-of-month projection
- Daily budget remaining (€X/day for the rest of the month)
- Close-month reward: stay under budget → earn 25 XP + trophy
- Clear an entire month with one tap (with confirmation)

### ⚗️ Alchemy (Vita / Diet)
- Daily meal log (breakfast, snack AM, lunch, snack PM, dinner)
- Weight tracking with historical entries
- Habit tracker with per-habit logs
- Routine management

### 👑 Hero (Profile)
- Editable hero name
- Level system: Recruit → Warrior → Knight → Warlord → King (based on XP)
- 4 hero themes: Warrior (amber/purple), Ocean (cyan/navy), Forest (emerald), Crimson (rose)
- Trophy cabinet — badges earned for achievements
- Daily browser reminder (time + on/off saved to DB)
- Push notification subscription (works even when app is closed)
- Stats grid and streak history
- Full data wipe option

### 🎖️ Rewards & Gamification
- XP awarded per milestone completion (proportional to quest priority)
- Level badges displayed throughout the app
- Streak counter — breaks if you miss a day
- Trophies: First Quest, 10 Expenses logged, Month Saved, and more

---

## 🛠️ Tech Stack

| Technology | Version | Notes |
|---|---|---|
| **Next.js** | 16.x | App Router, Server Actions, TypeScript |
| **React** | 19.x | |
| **Tailwind CSS** | v4 | CSS-variable-based theming, no config file |
| **Prisma** | 7.x | Requires driver adapter (breaking change from v6) |
| **NextAuth** | v5 beta | JWT strategy, Google OAuth |
| **Supabase** | — | PostgreSQL, pgBouncer pooler on port 6543 |
| **Vercel** | — | Auto-deploy from `main`, Edge-compatible |
| **SheetJS (xlsx)** | — | Client-side ISYbank Excel parsing |
| **web-push** | — | VAPID push notifications |
| **next-pwa** | — | Service Worker, installable PWA |

---

## 🗄️ Database Schema (key models)

| Model | Purpose |
|---|---|
| `User` | Auth + XP points + theme + reminder prefs |
| `Goal` | Quest with priority, progress, guide type, reminder schedule |
| `Milestone` | Sub-task of a Goal, toggleable, awards XP |
| `Category` | Goal categories (Health, Work, Finance, etc.) |
| `Expense` | Single spending entry linked to a month |
| `MonthlyBudget` | Budget ceiling per user per month |
| `Habit` + `HabitLog` | Daily habit tracking |
| `WeightEntry` | Weight measurements over time |
| `MealLog` | Meal diary entries |
| `PushSubscription` | Web push endpoint/keys per device |
| `Reward` + `UserReward` | Trophy definitions and earned badges |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Supabase free tier works great)
- Google OAuth credentials

### 1. Clone & install

```bash
git clone https://github.com/Baldborne94/goal-tracker.git
cd goal-tracker
npm install
```

### 2. Environment variables

Create a `.env` file in the project root:

```env
# Database — use pgBouncer URL for runtime, direct URL for migrations
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"

# NextAuth — generate with: openssl rand -base64 32
AUTH_SECRET="your-stable-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (console.cloud.google.com)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Web Push VAPID keys — generate with: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"

# Cron job protection
CRON_SECRET="your-cron-secret"
```

### 3. Set up the database

```bash
# Push schema to your database
npx prisma db push

# Seed default categories
npx tsx prisma/seed.ts
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📦 Deploy to Vercel

1. Push to GitHub and import the repo in [vercel.com](https://vercel.com)
2. Add all environment variables from `.env` in **Settings → Environment Variables**
   - Set `AUTH_SECRET` to a strong stable value (critical for session persistence)
   - Set `NEXTAUTH_URL` to your Vercel production URL
3. The build script (`prisma generate && npx tsx prisma/seed.ts && next build`) runs automatically
4. Schema migrations use `ALTER TABLE IF NOT EXISTS` in `prisma/seed.ts` — no `prisma db push` needed on Vercel

### Important: Google OAuth redirect URI
In [Google Cloud Console](https://console.cloud.google.com) → Credentials → your OAuth client, add:
```
https://your-app.vercel.app/api/auth/callback/google
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (app)/                    # Authenticated layout (auth guard)
│   │   ├── dashboard/            # Realm — XP, streak, weekly recap
│   │   ├── goals/                # Quest list, detail, new, edit
│   │   ├── finance/              # Treasury — budget & expenses
│   │   ├── vita/                 # Alchemy hub — diet, weight, habits
│   │   ├── diet/                 # Meal log
│   │   ├── routine/              # Habit tracker
│   │   └── profile/              # Hero profile + themes
│   ├── login/                    # Google OAuth login page
│   ├── onboarding/               # First-run setup
│   └── api/
│       ├── auth/[...nextauth]/   # NextAuth v5 handler
│       ├── goals/[id]/
│       │   └── milestones/[mid]/ # PATCH — toggle + award XP
│       ├── kakeebo/
│       │   ├── budget/           # GET/POST monthly budget
│       │   ├── expenses/         # GET/POST/DELETE expenses
│       │   │   └── [id]/         # PATCH/DELETE single expense
│       │   └── close-month/      # POST — claim month reward
│       ├── push/                 # Subscribe + send test notification
│       └── cron/reminders/       # Scheduled push reminders
├── components/
│   ├── finance/FinanceClient.tsx # Treasury UI (budget, chart, ISYbank import)
│   ├── goals/GoalForm.tsx        # Create/edit quest form with reminder picker
│   ├── goals/GoalDetailClient.tsx
│   ├── layout/BottomNav.tsx      # Bottom navigation with hero level icon
│   ├── ThemeProvider.tsx         # CSS variable theming (4 hero themes)
│   ├── ProfileClient.tsx         # Hero profile client component
│   └── NotificationButton.tsx    # Push notification opt-in
└── lib/
    ├── auth.ts                   # NextAuth v5 config (Google, JWT, PKCE disabled)
    ├── db.ts                     # Prisma singleton with pgBouncer adapter
    ├── rewards.ts                # XP awards + trophy unlock logic
    └── utils.ts                  # calculateStreak, helpers
```

---

## 🎨 Theming

The app uses **CSS custom properties** set by `ThemeProvider`. Four hero themes:

| Theme | Accent | Background |
|---|---|---|
| Warrior (default) | Amber/Gold | Deep purple |
| Ocean | Cyan | Dark navy |
| Forest | Emerald | Dark green |
| Crimson | Rose | Near-black |

Variables: `--theme-bg`, `--theme-surface`, `--theme-surface-border`, `--theme-text`, `--theme-text-muted`, `--theme-accent`, `--theme-gradient`, `--theme-border`, `--theme-bar`, `--theme-glow`

---

## 🔔 Push Notifications

The app supports Web Push (service worker based). Cron endpoint `/api/cron/reminders` fires daily — it checks each user's goals for matching reminder schedules (daily / weekly day / monthly day / custom weekdays) and sends a push to all their subscribed devices.

To set up on Vercel, configure a cron job:
```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 * * * *" }]
}
```

---

## 📄 License

MIT
