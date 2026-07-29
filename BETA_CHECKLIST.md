# Checklist pre-beta — test manuale su device

Questi controlli richiedono un dispositivo reale (soprattutto Android PWA) e non
possono essere automatizzati. Falli prima di aprire l'app a utenti esterni.

## 0. Configurazione su Vercel (Environment Variables)
- [ ] `ANTHROPIC_API_KEY` impostata (necessaria per Svuota Frigo)
- [ ] `AUTH_SECRET` (o `NEXTAUTH_SECRET`) impostata
- [ ] `DATABASE_URL` punta a Supabase pgBouncer (porta 6543)
- [ ] Google OAuth: redirect URI di produzione autorizzato nella Google Console

## 1. Autenticazione (il punto storicamente fragile su Android)
- [ ] Login con Google da **browser desktop** → entra correttamente
- [ ] Login con Google da **PWA installata su Android** → entra senza doppio login
  (è il caso per cui PKCE è disabilitato — verificare che non sia regredito)
- [ ] Logout e re-login → sessione ripristinata
- [ ] La sessione persiste dopo aver chiuso e riaperto la PWA

## 2. Svuota Frigo (endpoint AI a pagamento)
- [ ] Aggiungi ingredienti e genera → la ricetta appare in streaming
- [ ] La ricetta viene salvata automaticamente e resta dopo refresh
- [ ] "Rigenera" sostituisce la ricetta esistente (non ne crea una nuova)
- [ ] **Rate limit**: dopo 15 generazioni nello stesso giorno appare il messaggio
  "Hai raggiunto il limite di 15 generazioni per oggi" (HTTP 429)
- [ ] Elimina una ricetta → sparisce

## 3. Sfide giornaliere
- [ ] Logga un pasto nella dieta → la sfida "meals" diventa
  riscattabile e l'XP viene assegnato
- [ ] Le sfide ruotano (gruppo nuovo ogni 7 giorni)

## 4. Vita — creazione tabelle al primo accesso
Le tabelle di Vita si creano in modo lazy alla prima scrittura. Verificare che
ogni sezione funzioni da DB pulito:
- [ ] Peso: aggiungi una misurazione → salvata
- [ ] Dieta: aggiungi un alimento → salvato + kcal aggiornate
- [ ] Palestra: aggiungi/rimuovi un esercizio nel Programma → persistono
- [ ] Spesa: aggiungi, metti in carrello, rimetti in lista → coerente

## 5. Robustezza / errori
- [ ] Con `ANTHROPIC_API_KEY` mancante, Svuota Frigo mostra un errore chiaro
  (non crasha la pagina)
- [ ] Controllare i log di Vercel: gli errori ora sono righe JSON con
  `"level":"error"` (cercare `svuota-frigo.generation_failed` per i fallimenti AI)

## 6. PWA
- [ ] Installazione "Aggiungi a schermata Home" funziona su Android e iOS
- [ ] Icona e splash corretti
- [ ] Reminder browser (Notification API) chiede il permesso e funziona

---

### Note sul monitoraggio errori
Gli errori server sono loggati come JSON strutturato su stdout/stderr e visibili
nei log della piattaforma di hosting (Vercel → Logs). Per un upgrade futuro,
`src/lib/log.ts` è il punto unico dove inoltrare gli errori a un servizio tipo
Sentry (basta aggiungere la chiamata in `logError`).
