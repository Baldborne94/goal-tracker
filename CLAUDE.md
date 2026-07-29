@AGENTS.md

# Goal Tracker — Project Context

## What this app does
A gamified goal/habit tracker built with Next.js 16 App Router, Prisma 7, Supabase (PostgreSQL), NextAuth v5 (JWT), and Tailwind CSS v4. **Distributed as an Android APK only** (Capacitor WebView shell loading the Vercel deployment); browser PWA installability was deliberately removed — the site stays online because it *is* the backend.

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
- **Salute (Health Connect)** — wearable metrics from a Samsung Galaxy Fit3, read through a Capacitor WebView shell; charts, sleep-stage breakdown, and quests that auto-check from a metric threshold

## Tech stack & patterns
- **Next.js 16 App Router** — `searchParams` is a `Promise`; server + client components
- **Auth** — NextAuth v5 JWT (`trustHost: true`, `secret: AUTH_SECRET ?? NEXTAUTH_SECRET`, `maxAge: 30 days`); Google OAuth with **PKCE disabled** (`checks: ["state"]`) — required for Android PWA + Chrome Custom Tab cookie isolation; `auth()` works in server components & layout; mutations use **Server Actions** (not fetch API routes) to avoid auth issues
- **DB** — Prisma 7 + Supabase pgBouncer (port 6543); `package.json` build: `prisma generate && npx tsx prisma/seed.ts && next build`; schema migrations use `ALTER TABLE IF NOT EXISTS` in seed.ts — **never `prisma db push`** in build (hangs on pgBouncer advisory locks)
- **ThemeProvider** — `src/components/ThemeProvider.tsx`; reads localStorage synchronously in `useState` initializer (FOUC prevention); accepts `initialTheme` prop from AppLayout (loaded from DB); `suppressHydrationWarning` on wrapper div
- **Server Actions** — `src/app/(app)/profile/actions.ts` exports `updateProfileName`, `updateTheme`, `updateReminder`
- **ISYbank import** — `parseExcelFile()` in FinanceClient.tsx; dynamically imports SheetJS (`import("xlsx")`); finds header row by "Tipologia" column; only imports "Uscite" rows with negative Importo; converts dd/MM/yyyy → YYYY-MM-DD; maps Italian categories via `ISYBANK_CAT_MAP`
- **Android shell** — Capacitor 8 WebView loading the deployed app from `server.url` (one deploy, no second codebase); bridges Health Connect and native Google Sign-In. See `docs/ANDROID.md`
- **Google login in the APK** — Google forbids web OAuth inside embedded WebViews (`disallowed_useragent`). Primary path: system browser + one-time ticket — the login page opens a Custom Tab (`@capacitor/browser`) on `/api/mobile-auth/start`, web OAuth runs in the real browser, `/api/mobile-auth/finish` mints a 2-minute single-use ticket (hash-only in `LoginTicket`) and bounces to the `goaltracker://login?ticket=…` deep link; the app consumes it via the `ticket` Credentials provider (atomic `DELETE … RETURNING`), and the session cookie is born in the WebView. Fallback for shells built before the Browser/App plugins: native Sign-In (`@capgo/capacitor-social-login` → ID token → `google-native` provider, verifies aud/iss/email_verified via tokeninfo; needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID` env + Android OAuth client with package + SHA-1 + `ANDROID_DEBUG_KEYSTORE_B64` GitHub secret). The fallback exists because Credential Manager fails with `[16] Account reauth failed` on some devices with a fully correct OAuth setup — unfixable app-side, which is why the browser path is primary

## Salute / Health Connect (Fase 2)
- **Data chain** — Galaxy Fit3 → Samsung Health → Health Connect → Capacitor shell → `POST /api/health/sync` → Supabase
- **Plugin: `@capgo/capacitor-health`** — chosen after checking the source, not the README: `HealthManager.kt` really maps `SleepSessionRecord` (with stages), `DistanceRecord`, `FloorsClimbedRecord`, `OxygenSaturationRecord`; most recently published of the candidates. Rejected: `ubie-oss/capacitor-health-connect` (14 types, no sleep/distance/workout/floors), `@flomentumsolutions/capacitor-health-extended` and `mley/capacitor-health` (both fine but staler)
- **Sleep needs `readSamples()`** — Health Connect's aggregate queries don't return sleep stages
- **Verified limits** (don't re-litigate these):
  - **Stress is not obtainable** — Health Connect has no stress record type; it's a proprietary Samsung metric. Manual entry only
  - **Resting HR and HRV are unreliable** — Samsung Health often doesn't write them to Health Connect. Flagged `unreliable: true` in the registry and rendered as `—`, never as an error
  - **PWAs cannot reach Health Connect** — that's the whole reason for Capacitor
  - **Health Connect misbehaves on emulators** — final testing happens on a real phone
  - **Sync is not realtime** — on screen open and on the refresh button, never streaming
- **Metric registry** — `src/lib/health.ts` is the single place a metric is declared (label, unit, icon, aggregation, history window, `core`, `moreIsBetter`). Adding one needs **no migration**: `HealthMetric` is generic (`metricType`/`value`/`unit`/`metadata` jsonb)
- **What the screen shows** — a tile appears if the metric is `core` (steps, sleep, calories, distance, heart rate — the Fit3 really measures them, so a dash there means "hasn't synced") **or** it has data. Nothing lists the metrics that will never arrive: HRV and resting HR aren't shared by Samsung Health, the Fit3 has no altimeter, body fat needs a smart scale. They reappear on their own the day a sample shows up
- **Dedup** — re-reading the same day must not duplicate rows. `dedupKey` = Health Connect record id when available, else `type:start:end:source`. It deliberately excludes the value, so a corrected sample updates in place. Enforced by `UNIQUE(userId, dedupKey)` + `ON CONFLICT DO UPDATE`
- **Local dates** — the client normalises samples before POSTing because the day boundary must use the *phone's* timezone, not the server's
- **Quest auto-check** — `Goal.healthMetric` + `Goal.healthTarget`; on sync `applyHealthGoals()` inserts a `QuestCheckIn` and awards XP when the day's aggregate reaches the target. Idempotent via the existing `UNIQUE(goalId, userId, date)`

## Key files
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | DB schema; User has: `points`, `theme`, `reminderEnabled`, `reminderTime` |
| `prisma/seed.ts` | Seeds default categories; MIGRATIONS array for idempotent `ALTER TABLE IF NOT EXISTS` schema updates |
| `src/lib/auth.ts` | NextAuth v5 config (JWT, Google OAuth, PKCE disabled, trustHost); providers: `google-native`, `ticket`, `password` |
| `src/lib/login-ticket.ts` | Pure contract of the APK login deep link (scheme, ticket format, build/extract) — client-safe, no Node imports |
| `src/lib/mobile-auth.ts` | Server side of one-time login tickets: mint (`issueLoginTicket`) and atomic consume (`consumeLoginTicket`) |
| `src/app/api/mobile-auth/start/route.ts` | Opened in the system browser by the shell; starts web OAuth (or skips it if the browser already has a session) |
| `src/app/api/mobile-auth/finish/route.ts` | Mints the ticket and serves the jump page to `goaltracker://login?ticket=…` (HTML with button, not a 302 — Chrome blocks gesture-less custom-scheme redirects) |
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
| `src/lib/health.ts` | Salute metric registry + pure helpers (normalise, dedup key, daily aggregation, delta vs yesterday, sleep-stage series, it-IT formatting) |
| `src/lib/capacitor-health.ts` | Health Connect bridge; dynamic plugin import, no-op off native |
| `src/lib/health-goals.ts` | `applyHealthGoals()` — auto check-in when a quest's metric hits its target |
| `src/app/api/health/sync/route.ts` | POST — chunked `ON CONFLICT` upsert of wearable samples, then auto check-ins |
| `src/app/api/health/route.ts` | GET series by type/range; DELETE one metric's history |
| `src/components/salute/SaluteClient.tsx` | Salute screen: steps hero + goal bar, sleep card with stage trend, compact tiles with delta + sparkline, sync button |
| `capacitor.config.ts` | WebView shell config; `CAPACITOR_SERVER_URL` overrides the Vercel URL |
| `docs/ANDROID.md` | APK build/install, phone prerequisites, plugin research, troubleshooting |
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
- Don't add a column per health metric — declare it in the `METRICS` registry in `src/lib/health.ts`; the table is generic on purpose
- Don't list the unobtainable metrics anywhere in Salute — a catalogue of what will never arrive is noise, not information; a metric earns its tile by being `core` or by having data
- Don't colour a delta green/red on a metric without `moreIsBetter` — a +8% heart rate is not a verdict we're qualified to give
- Don't compute a health sample's `date` on the server — the day boundary belongs to the phone's timezone, so the client normalises before POSTing
- Don't put the sample's value in `dedupKey` — a corrected reading must update its row, not add one
- Don't use Health Connect's aggregate queries for sleep — they drop the stages; always `readSamples()`
- Don't try to read stress from Health Connect — there is no such record type (proprietary Samsung metric)
- Don't commit `android/app/src/main/assets/public/` — it's a copy of `public/` regenerated by `npx cap sync android`
- Don't re-add `manifest` to the root layout metadata — browser installability was removed on purpose; the app ships as APK only
- Don't try web OAuth inside the Capacitor WebView — Google rejects it (`disallowed_useragent`); the APK must use the `google-native` provider path
- Don't strip the Credential-Manager fallback — the native login tries `mode: online` first and falls back to `mode: offline` (`serverAuthCode` exchanged server-side); some devices fail online with `[16] Account reauth failed` on a fully correct OAuth setup
- Don't let `npx cap add android` regenerate `MainActivity.java` — it implements `ModifiedMainActivityForSocialLoginPlugin` and forwards `startIntentSenderForResult` results, without which offline sign-in refuses to start
- Don't let CI sign the APK with an ad-hoc keystore — the shared keystore (ANDROID_DEBUG_KEYSTORE_B64 secret) keeps the signature stable; without it updates require uninstall and native Google Sign-In breaks (SHA-1 mismatch)
- Don't turn the `/api/mobile-auth/finish` jump page into a 302 to the deep link — Chrome silently blocks server redirects to custom schemes without a user gesture; the page with the button is the reliable form
- Don't store login tickets in clear text or make them reusable — hash-only in `LoginTicket`, consumed with `DELETE … RETURNING` so a second spend finds nothing
- Don't assume the shell has the Browser/App plugins — old APKs load the same Vercel code; gate the browser login path behind `canUseBrowserLogin()` and keep the native fallback
