@AGENTS.md

# Goal Tracker — Project Context

## What this app does
A gamified goal/habit tracker PWA built with Next.js 16 App Router, Prisma 7, Supabase (PostgreSQL), NextAuth v5 (JWT), and Tailwind CSS.

**Key features:**
- **Quests (Goals)** — create goals with milestones, priority, category, tags, target date; complete milestones to earn XP
- **XP & Levelling** — earn XP completing milestones; level titles: Warrior → Knight → Guardian → Champion → Legend → Sovereign
- **Streak counter** — consecutive days with ≥1 completed milestone; shown on dashboard and profile
- **Weekly recap** — dashboard shows this-week milestones and goals
- **Quest suggestions** — AI-style panel suggests quests with pre-filled milestones based on user lifestyle
- **Share quest as template** — `btoa(JSON.stringify(data))` encoded in URL `?template=` param; decoded server-side
- **Hero Profile** — editable name (Server Action), hero theme (4 presets), daily browser reminder, stats grid, trophies, wipe-everything reset
- **Hero themes** — warrior (amber/purple), ocean (cyan/navy), forest (emerald/green), crimson (rose/dark); saved to **DB** + localStorage
- **Finance (Kakeebo)** — monthly budget, expense tracking by category, donut chart, 6-month trend, CSV import, close-month reward (25 XP + trophy), end-of-month reminder banner
- **Daily reminder** — browser Notification API with permission flow; time + enabled state saved to **DB** + localStorage

## Tech stack & patterns
- **Next.js 16 App Router** — `searchParams` is a `Promise`; server + client components
- **Auth** — NextAuth v5 JWT; `auth()` works in server components & layout; mutations use **Server Actions** (not fetch API routes) to avoid auth issues
- **DB** — Prisma 7 + Supabase; `package.json` build runs `prisma generate && prisma db push && next build` so schema migrations apply automatically on Vercel deploy
- **ThemeProvider** — `src/components/ThemeProvider.tsx`; reads localStorage synchronously in `useState` initializer (FOUC prevention); accepts `initialTheme` prop from AppLayout (loaded from DB); `suppressHydrationWarning` on wrapper div
- **Server Actions** — `src/app/(app)/profile/actions.ts` exports `updateProfileName`, `updateTheme`, `updateReminder`

## Key files
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | DB schema; User has: `points`, `theme`, `reminderEnabled`, `reminderTime` |
| `src/lib/auth.ts` | NextAuth v5 config (JWT, CredentialsProvider) |
| `src/lib/utils.ts` | `calculateStreak(dates)` |
| `src/app/(app)/layout.tsx` | Auth guard + BottomNav + ThemeProvider (passes DB theme) |
| `src/app/(app)/dashboard/page.tsx` | XP card (CSS vars), streak card, weekly recap |
| `src/app/(app)/profile/page.tsx` | Loads user, streak, reminder prefs from DB |
| `src/app/(app)/profile/actions.ts` | Server Actions: name, theme, reminder |
| `src/components/ProfileClient.tsx` | Hero name edit (nameStatus state machine), theme picker, daily reminder, stats, trophies, wipe reset |
| `src/components/ThemeProvider.tsx` | CSS vars on wrapper div; 4 themes; `initialTheme` prop |
| `src/components/finance/FinanceClient.tsx` | Budget card (toFixed(2)), donut chart, CSV import, close-month section with end-of-month reminder |
| `src/components/goals/GoalDetailClient.tsx` | Milestone toggle, share-as-template button, delete |
| `src/components/layout/BottomNav.tsx` | `heroIcon(points)` → 🗡️/⚔️/🛡️/🏰/👑 |
| `public/icon-192.svg` + `public/icon-512.svg` | PWA icons (dark bg + amber sword) |

## CSS variables (set by ThemeProvider)
`--theme-gradient`, `--theme-border`, `--theme-accent`, `--theme-bar`, `--theme-glow`

## Important patterns
- **Name save**: Server Action `updateProfileName(name)` in `actions.ts` — NOT a fetch call
- **Theme save**: `updateTheme(key)` server action + `localStorage.setItem("hero-theme", key)` + `setTheme(key)` from ThemeProvider context
- **Reminder save**: `updateReminder(enabled, time)` server action + localStorage sync
- **Milestone completion**: PATCH `/api/goals/[id]/milestones/[mid]` → awards XP, checks rewards
- **Finance close-month**: POST `/api/kakeebo/close-month` → awards 25 XP + trophy; button disabled when `isOver` (spent > budget)

## What NOT to do
- Don't use `fetch("/api/profile", PATCH)` for name save — use the Server Action
- Don't use `.toFixed(0)` for money amounts — use `.toFixed(2)`
- Don't push to `main` directly — use `fix/*` or `feat/*` branches, create PR, wait for Vercel CI green, then merge
