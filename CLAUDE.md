@AGENTS.md

# Goal Tracker — Project Context

## What this app does
A gamified goal/habit tracker PWA built with Next.js 16 App Router, Prisma 7, Supabase (PostgreSQL), NextAuth v5 (JWT), and Tailwind CSS v4.

**Key features:**
- **Quests (Goals)** — create goals with milestones, priority, category, tags, target date; complete milestones to earn XP
- **XP & Levelling** — earn XP completing milestones; level titles: Recruit → Warrior → Knight → Warlord → King (based on XP thresholds)
- **Streak counter** — consecutive days with ≥1 completed milestone; shown on dashboard and profile
- **Weekly recap** — dashboard shows this-week milestones and completed goals
- **Quest suggestions** — AI-style panel suggests quests with pre-filled milestones based on user lifestyle
- **Share quest as template** — `btoa(JSON.stringify(data))` encoded in URL `?template=` param; decoded server-side
- **Hero Profile** — editable name (Server Action), hero theme (4 presets), daily browser reminder, stats grid, trophies, wipe-everything reset
- **Hero themes** — warrior (amber/purple), ocean (cyan/navy), forest (emerald/green), crimson (rose/dark); saved to **DB** + localStorage
- **Finance (Kakeebo)** — monthly budget, expense tracking by category, donut chart, **12-month** spending trend, **ISYbank Excel import** (parses "Lista Operazioni" sheet, maps Italian categories), category filter chips in daily log, clear-month button, close-month reward (25 XP + trophy)
- **Daily reminder** — browser Notification API with permission flow; time + enabled state saved to **DB** + localStorage
- **Push notifications** — Web Push (VAPID) via service worker; cron endpoint sends reminders per goal schedule
- **Alchemy (Vita)** — meal log, weight tracking, habit tracker, routine management

## Tech stack & patterns
- **Next.js 16 App Router** — `searchParams` is a `Promise`; server + client components
- **Auth** — NextAuth v5 JWT (`trustHost: true`, `secret: AUTH_SECRET ?? NEXTAUTH_SECRET`, `maxAge: 30 days`); Google OAuth with **PKCE disabled** (`checks: ["state"]`) — required for Android PWA + Chrome Custom Tab cookie isolation; `auth()` works in server components & layout; mutations use **Server Actions** (not fetch API routes) to avoid auth issues
- **DB** — Prisma 7 + Supabase pgBouncer (port 6543); `package.json` build: `prisma generate && npx tsx prisma/seed.ts && next build`; schema migrations use `ALTER TABLE IF NOT EXISTS` in seed.ts — **never `prisma db push`** in build (hangs on pgBouncer advisory locks)
- **ThemeProvider** — `src/components/ThemeProvider.tsx`; reads localStorage synchronously in `useState` initializer (FOUC prevention); accepts `initialTheme` prop from AppLayout (loaded from DB); `suppressHydrationWarning` on wrapper div
- **Server Actions** — `src/app/(app)/profile/actions.ts` exports `updateProfileName`, `updateTheme`, `updateReminder`
- **ISYbank import** — `parseExcelFile()` in FinanceClient.tsx; dynamically imports SheetJS (`import("xlsx")`); finds header row by "Tipologia" column; only imports "Uscite" rows with negative Importo; converts dd/MM/yyyy → YYYY-MM-DD; maps Italian categories via `ISYBANK_CAT_MAP`

## Key files
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | DB schema; User has: `points`, `theme`, `reminderEnabled`, `reminderTime` |
| `prisma/seed.ts` | Seeds default categories; MIGRATIONS array for idempotent `ALTER TABLE IF NOT EXISTS` schema updates |
| `src/lib/auth.ts` | NextAuth v5 config (JWT, Google OAuth, PKCE disabled, trustHost) |
| `src/lib/utils.ts` | `calculateStreak(dates)` |
| `src/lib/rewards.ts` | XP awards + trophy unlock logic |
| `src/app/(app)/layout.tsx` | Auth guard + BottomNav + ThemeProvider (passes DB theme) |
| `src/app/(app)/dashboard/page.tsx` | XP card (CSS vars), streak card, weekly recap, today's focus, finance widget |
| `src/app/(app)/finance/page.tsx` | Treasury server page; builds 12-month trend data |
| `src/app/(app)/profile/page.tsx` | Loads user, streak, reminder prefs from DB |
| `src/app/(app)/profile/actions.ts` | Server Actions: name, theme, reminder |
| `src/app/api/kakeebo/expenses/route.ts` | GET/POST/DELETE expenses; DELETE accepts `?month=YYYY-MM` to clear whole month |
| `src/app/api/kakeebo/close-month/route.ts` | POST — awards 25 XP + trophy when under budget |
| `src/app/api/goals/[id]/milestones/[mid]/route.ts` | PATCH — toggle milestone + award XP |
| `src/app/api/cron/reminders/route.ts` | Scheduled push reminders; protected by CRON_SECRET |
| `src/components/ProfileClient.tsx` | Hero name edit (nameStatus state machine), theme picker, daily reminder, stats, trophies, wipe reset |
| `src/components/ThemeProvider.tsx` | CSS vars on wrapper div; 4 themes; `initialTheme` prop |
| `src/components/finance/FinanceClient.tsx` | Budget card, donut chart, 12-month trend, ISYbank Excel import, category filter chips, clear-month modal, close-month reward |
| `src/components/goals/GoalDetailClient.tsx` | Milestone toggle, share-as-template button, delete |
| `src/components/layout/BottomNav.tsx` | `heroIcon(points)` → 🗡️/⚔️/🛡️/🏰/👑; nav: Realm/Quests/Treasury 💎/Alchemy ⚗️/Hero |
| `public/icon-192.svg` + `public/icon-512.svg` | PWA icons (dark bg + amber sword) |

## CSS variables (set by ThemeProvider)
`--theme-bg`, `--theme-surface`, `--theme-surface-border`, `--theme-text`, `--theme-text-muted`, `--theme-accent`, `--theme-gradient`, `--theme-border`, `--theme-bar`, `--theme-glow`

## Important patterns
- **Name save**: Server Action `updateProfileName(name)` in `actions.ts` — NOT a fetch call
- **Theme save**: `updateTheme(key)` server action + `localStorage.setItem("hero-theme", key)` + `setTheme(key)` from ThemeProvider context
- **Reminder save**: `updateReminder(enabled, time)` server action + localStorage sync
- **Milestone completion**: PATCH `/api/goals/[id]/milestones/[mid]` → awards XP, checks rewards
- **Finance close-month**: POST `/api/kakeebo/close-month` → awards 25 XP + trophy; button disabled when `isOver` (spent > budget)
- **Clear month**: DELETE `/api/kakeebo/expenses?month=YYYY-MM` → deletes all expenses for that month
- **Schema migrations**: Add new columns via `prisma.$executeRawUnsafe('ALTER TABLE "X" ADD COLUMN IF NOT EXISTS ...')` in the MIGRATIONS array in `prisma/seed.ts`
- **ISYbank category map**: `ISYBANK_CAT_MAP` at top of FinanceClient.tsx maps Italian category strings (lowercase) to app category keys; extend it for new mappings

## What NOT to do
- Don't use `fetch("/api/profile", PATCH)` for name save — use the Server Action
- Don't use `.toFixed(0)` for money amounts — use `.toFixed(2)`
- Don't push to `main` directly — use `fix/*` or `feat/*` branches, create PR, wait for Vercel CI green, then merge
- Don't add `prisma db push` to the build script — it hangs on Supabase pgBouncer (port 6543) advisory locks
- Don't re-enable PKCE for Google OAuth — `checks: ["state"]` is intentional; disabling PKCE fixes Android PWA double-login (CCT vs PWA webview cookie isolation)
