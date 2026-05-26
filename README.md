# Goal Tracker — Documentazione

App web per tracciare obiettivi personali, con tema dark fantasy RPG e modulo budget Kakeebo.
Costruita con Next.js 16, Prisma 7, NextAuth v5, Tailwind CSS v4, deployata su Vercel con database Supabase PostgreSQL.

---

## Stack tecnico

| Tecnologia | Versione | Note |
|---|---|---|
| Next.js | 16.x | App Router, TypeScript strict |
| React | 19.x | |
| Tailwind CSS | v4 | Nessun `tailwind.config.js`, usa `@import "tailwindcss"` in globals.css |
| Prisma | 7.x | Breaking change: richiede driver adapter, no `url` in schema |
| `@prisma/adapter-pg` | 7.x | Richiesto da Prisma 7 per PostgreSQL |
| NextAuth | v5 beta | JWT strategy, CredentialsProvider |
| Supabase | — | PostgreSQL hosted, porta 6543 PgBouncer |
| Vercel | — | Deploy automatico da branch `main` |

---

## Variabili d'ambiente

Creare un file `.env` nella root (non committare mai questo file):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
NEXTAUTH_SECRET="una-stringa-segreta-lunga"
NEXTAUTH_URL="http://localhost:3000"
```

Su Vercel impostare le stesse variabili nel pannello **Settings → Environment Variables**, con `NEXTAUTH_URL` puntato all'URL di produzione (es. `https://goal-tracker-xxx.vercel.app`).

> `DATABASE_URL` usa la porta 6543 (PgBouncer) per le query runtime.
> `DIRECT_URL` usa la porta 5432 (connessione diretta) per le migrazioni Prisma.

---

## Setup locale

```bash
# 1. Installa dipendenze
npm install

# 2. Crea il file .env (vedi sopra)

# 3. Applica lo schema al database e genera il client
npx prisma db push

# 4. Avvia il server di sviluppo
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

---

## Build e deploy

Il build script è:

```bash
prisma generate && prisma db push && next build
```

- `prisma generate` — genera il client TypeScript da `prisma/schema.prisma`
- `prisma db push` — sincronizza lo schema con il database (crea tabelle mancanti)
- `next build` — compila l'app

Su Vercel il deploy avviene automaticamente ad ogni push su `main`.

---

## Struttura del progetto

```
src/
├── app/
│   ├── (app)/                  # Layout autenticato (richiede login)
│   │   ├── dashboard/          # Homepage con riepilogo e ultime missioni
│   │   ├── goals/              # Lista di tutti gli obiettivi
│   │   │   ├── new/            # Crea nuovo obiettivo
│   │   │   └── [id]/           # Dettaglio obiettivo
│   │   │       └── edit/       # Modifica obiettivo
│   │   ├── kakeebo/            # Budget tracker mensile
│   │   └── profile/            # Profilo utente con XP e livello
│   ├── (auth)/                 # Layout non autenticato
│   │   ├── login/
│   │   └── register/
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handler
│       ├── goals/              # CRUD obiettivi
│       │   └── [id]/
│       │       └── milestones/ # Toggle milestone completata
│       ├── kakeebo/
│       │   ├── budget/         # GET/POST budget mensile
│       │   └── expenses/       # GET/POST spese
│       │       └── [id]/       # DELETE spesa
│       ├── categories/
│       ├── register/
│       └── user/
├── components/
│   ├── goals/
│   │   ├── GoalForm.tsx        # Form crea/modifica obiettivo
│   │   ├── GoalsList.tsx       # Lista con filtri status e categoria
│   │   └── GoalDetailClient.tsx# Dettaglio con milestone e progresso
│   ├── kakeebo/
│   │   └── KakeeboClient.tsx   # Budget + lista spese (client component)
│   ├── layout/
│   │   └── BottomNav.tsx       # Navigazione inferiore
│   └── ProfileClient.tsx       # Profilo con livello XP
└── lib/
    ├── auth.ts                 # Configurazione NextAuth v5
    ├── db.ts                   # Prisma client con adapter PG
    ├── rewards.ts              # Logica badge e trofei
    └── utils.ts                # Helper (cn, formatDate, getPriority…)
```

---

## Database — Modelli Prisma

### User
Utente autenticato. Campi principali: `id`, `name`, `email`, `password` (hash bcrypt), `points` (XP).

### Goal
Obiettivo personale. Campi: `title`, `description`, `status` (active/completed/archived), `priority` (low/medium/high), `progress` (0–100), `targetDate`, `points` (XP da guadagnare), `categoryId`, `userId`.

### Milestone
Sotto-obiettivo di un Goal. Campi: `title`, `completed`, `order`.

### Category
Categoria per raggruppare i Goal. Campi: `name`, `color` (hex), `icon`.

### Tag / GoalTag
Tag liberi associati ai Goal (relazione many-to-many).

### Reward / UserReward
Trofei/badge guadagnati completando obiettivi. Assegnati automaticamente da `src/lib/rewards.ts`.

### MonthlyBudget
Budget mensile Kakeebo. Chiave unica `(userId, month)` dove `month` è in formato `"2026-05"`.

### Expense
Singola spesa. Campi: `amount`, `category` (cibo/trasporti/svago/casa/salute/hobby/extra), `merchant` (dove), `description` (cosa), `date`.

---

## Funzionalità

### Obiettivi (Missioni)
- Crea, modifica, elimina obiettivi
- Filtro per status (tutte / attive / completate) e per categoria
- Milestone: sotto-obiettivi con checkbox; il progresso si aggiorna automaticamente
- Tag liberi
- Data scadenza
- Priorità (Bassa / Media / Alta)
- Completare un obiettivo assegna XP e può sbloccare trofei

### Dashboard (Reame)
- Riepilogo XP totali, missioni attive e completate
- Ultimi 5 obiettivi con barra di progresso
- Trofei ottenuti
- FAB `+` per aggiungere rapidamente un obiettivo

### Profilo (Eroe)
- Livello basato su XP:
  - 🌱 Apprendista (0–49 XP)
  - ⚔️ Avventuriero (50–149 XP)
  - 🛡️ Guerriero (150–349 XP)
  - 🏆 Campione (350–699 XP)
  - 👑 Leggenda (700+ XP)
- Barra XP verso il livello successivo
- Statistiche: missioni totali, completate, attive

### Kakeebo (Oro)
- Imposta budget mensile
- Registra spese con importo, categoria, dove, cosa, data
- Card budget: mostra Budget / Speso / Rimanente con barra di avanzamento
  - Barra viola → ambra (75%) → rossa (100%)
- Navigazione per mese (mese precedente / successivo)
- Elimina spesa con `×`
- Categorie disponibili: 🍕 Cibo, 🚗 Trasporti, 🎮 Svago, 🏠 Casa, 💊 Salute, 🎲 Hobby, 📦 Extra

---

## Dettagli tecnici importanti

### Prisma 7 — driver adapter obbligatorio
Prisma 7 ha cambiato l'`engineType` default a `"client"`, che richiede un driver adapter.
Senza adapter si ottiene: `PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"`.

Soluzione in `src/lib/db.ts`:
```ts
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg(process.env.DATABASE_URL!);
return new PrismaClient({ adapter });
```

### Prisma 7 — schema senza `url`
In Prisma 7 l'URL del datasource non si mette più in `schema.prisma` ma nel file `prisma.config.ts`:
```ts
// prisma.config.ts
import { defineConfig } from "prisma/config";
export default defineConfig({
  datasourceUrl: process.env["DATABASE_URL"],
});
```

### TypeScript strict + Prisma
Con `"strict": true` in `tsconfig.json`, i parametri di callback `.map()` / `.filter()` / `.reduce()` richiedono annotazioni di tipo esplicite quando il tipo Prisma non è pre-generato.
Soluzione: aggiungere `prisma generate` come primo step del build script.

### NextAuth v5
- Configurazione in `src/lib/auth.ts`
- Handler in `src/app/api/auth/[...nextauth]/route.ts`
- Nei Server Components: `const session = await auth()`
- Nelle Route Handlers: stesso pattern

---

## Note sul deploy Vercel

1. Collegare il repository GitHub a Vercel
2. Impostare le variabili d'ambiente (DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL)
3. Il build command viene letto da `package.json` automaticamente
4. `prisma db push` nel build crea le tabelle mancanti ad ogni deploy — sicuro per cambiamenti additivi (nuove tabelle/colonne opzionali)
5. Per cambiamenti distruttivi (rinominare/eliminare colonne) usare invece `prisma migrate deploy` con file di migrazione
