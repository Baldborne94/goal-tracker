# App Android + Galaxy Fit3 (Health Connect)

Guida per buildare l'APK e leggere i dati del braccialetto. I test finali vanno
fatti **sul telefono reale**: Health Connect non funziona bene sugli emulatori.

## Com'è fatta

L'app Android non è una seconda codebase: è un guscio **Capacitor in modalità
WebView** che carica la PWA già deployata su Vercel. Serve solo per il ponte
nativo verso Health Connect, che una PWA nel browser non può usare.

```
Galaxy Fit3 → Samsung Health → Health Connect → guscio Android → /api/health/sync → Supabase
```

Un solo deploy da mantenere: aggiornando la PWA su Vercel si aggiorna anche
l'app, senza ricompilare l'APK. L'APK va ricompilato solo se cambiano il guscio,
i permessi o il plugin.

## Prerequisiti sul telefono

0. **Android 8.0 (API 26) o superiore.** Health Connect non esiste sotto quella
   versione, quindi `minSdkVersion` in `android/variables.gradle` è 26 e non
   può scendere.
1. **Health Connect** installato. Su Android 14+ è già di sistema; su versioni
   precedenti va installato dal Play Store («Health Connect by Android»).
2. **Samsung Health** configurato per condividere i dati con Health Connect:
   Samsung Health → Impostazioni → Health Connect → attiva i permessi di
   scrittura per passi, sonno, battito, ecc.
3. Il Fit3 deve aver già sincronizzato con Samsung Health (apri l'app almeno una
   volta dopo aver indossato il braccialetto).

## Scaricare l'APK senza installare niente (consigliato)

L'APK **non è nel repository**: va compilato. Ci pensa GitHub, che ha già
l'SDK Android pronto.

### Dal telefono — release

**https://github.com/Baldborne94/goal-tracker/releases/latest**

Tocca `goal-tracker.apk` e installalo. È un link diretto e pubblico: non
serve essere loggati, non è uno zip. L'indirizzo non cambia mai — ogni build
su `main` sostituisce il file.

### Dal PC — artifact di Actions

Utile per provare l'APK di una PR prima del merge:

1. **Actions → Build APK Android**, apri il run che ti interessa
2. In fondo alla pagina, riquadro **Artifacts** → `goal-tracker-debug-apk`
3. È uno zip: scompattalo per ottenere `app-debug.apk`

Gli artifact **richiedono di essere loggati su GitHub** e restano 90 giorni.
Dal browser del telefono spesso non sono nemmeno cliccabili: per quello c'è
la release. Se ci provi comunque, attiva «Sito desktop» nel menu del browser.

### Buildare a mano

Il workflow ha anche **Run workflow** (`workflow_dispatch`), dove puoi
indicare un URL diverso da caricare. Parte da solo a ogni push su `main` che
tocchi `android/`, `capacitor.config.ts` o `public/`.

## Prerequisiti sul PC (solo per la build locale)

- **Node 20+** e le dipendenze del progetto (`npm install`)
- **Android Studio** (include SDK e `adb`), oppure il solo Android SDK con
  `ANDROID_HOME` impostato
- **JDK 21**

## Build dell'APK

```bash
# 1. Allinea il progetto nativo a config e plugin
npx cap sync android

# 2. APK di debug — firmato con la chiave di debug, sufficiente per installarlo a mano
cd android && ./gradlew assembleDebug
```

L'APK esce in:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

## Installazione sul telefono

**Via cavo USB** (richiede Debug USB attivo in Opzioni sviluppatore):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Senza cavo**: copia `app-debug.apk` sul telefono (Drive, Telegram, email),
aprilo dal file manager e concedi «installa app sconosciute» quando richiesto.

## Puntare a un server diverso

Di default il guscio carica la produzione su Vercel. Per svilupparlo contro il
dev server locale, con il telefono sulla stessa rete Wi-Fi:

```bash
CAPACITOR_SERVER_URL=http://192.168.1.10:3000 npx cap sync android
cd android && ./gradlew assembleDebug
```

`cleartext` si attiva da solo quando l'URL è `http://` (vedi
`capacitor.config.ts`). Ricordati di riportarlo alla produzione prima di
generare un APK da tenere.

## Primo avvio

1. Apri l'app e fai login.
2. Vai su **Vita → Salute**.
3. Premi **↻ Aggiorna**: si apre il foglio dei permessi di Health Connect.
4. Concedi i tipi di dato che ti interessano e attendi la sincronizzazione.

La sincronizzazione **non è realtime** per scelta: parte all'apertura della
schermata e col pulsante di aggiornamento, mai in streaming.

## Cosa si riesce a leggere davvero

| Dato | Stato |
|---|---|
| Passi, distanza, piani saliti | ✅ |
| Calorie attive e totali | ✅ |
| Sonno con fasi (profondo / leggero / REM / sveglio) | ✅ |
| Battito cardiaco (serie) | ✅ |
| Ossigenazione (SpO2) | ✅ |
| Sessioni di allenamento (tipo, durata, calorie, distanza) | ✅ |
| Peso, massa grassa | ✅ se inseriti in Samsung Health |
| Battito a riposo, HRV | ⚠️ spesso Samsung Health non li scrive su Health Connect |
| **Stress** | ❌ **non ottenibile** |

Sullo **stress**: Health Connect non ha un tipo di record per lo stress, è una
metrica proprietaria Samsung. Non è un limite dell'app né del plugin: l'unico
modo di averlo è l'inserimento manuale.

Battito a riposo e HRV vengono gestiti come «dato assente»: la schermata Salute
mostra `—` con una nota, senza errori né crash.

## Scelta del plugin

Usiamo **`@capgo/capacitor-health`**. Verificato leggendo il sorgente, non solo
il README:

- `HealthDataType` include `sleep`, `distance`, `flightsClimbed`,
  `oxygenSaturation`, `restingHeartRate`, `heartRateVariability`, `bodyFat`,
  `totalCalories`, `workouts`
- `HealthManager.kt` mappa davvero `SleepSessionRecord` (con le fasi),
  `DistanceRecord`, `FloorsClimbedRecord`, `OxygenSaturationRecord`
- `HealthSample.stages[]` espone le fasi del sonno con durata per segmento

Alternative scartate:

- **`ubie-oss/capacitor-health-connect`** — copre solo 14 tipi, senza sonno,
  distanza, workout e piani saliti.
- **`@flomentumsolutions/capacitor-health-extended`** — funzionalmente adatto,
  ma l'ultima pubblicazione su npm è di febbraio 2026 contro luglio 2026 di
  capgo.
- **`mley/capacitor-health`** — mantenuto, ma meno aggiornato (maggio 2026).

Il sonno si legge sempre con `readSamples()`: le query aggregate di Health
Connect non restituiscono le fasi.

## Login Google nell'APK

Google **rifiuta l'OAuth web dentro le WebView incorporate**
(`disallowed_useragent`), quindi dentro l'APK il redirect di NextAuth nella
WebView non è percorribile. I percorsi sono due, e la pagina di login sceglie
da sola.

### Percorso primario: browser di sistema + ticket monouso

Il Sign-In nativo dipende dal Credential Manager di Google, che su alcuni
dispositivi rifiuta l'accesso con `[16] Account reauth failed` a
configurazione OAuth perfettamente corretta — è stato di Play Services sul
telefono, non un bug dell'app. Il browser di sistema invece fa l'OAuth web
di Google senza eccezioni. Il problema da risolvere è solo il trasloco della
sessione: i cookie del browser non sono quelli della WebView.

La catena (`src/lib/login-ticket.ts` ha il disegno, `src/lib/mobile-auth.ts`
il lato server):

1. Il pulsante Google apre una **Custom Tab** (`@capacitor/browser`) su
   `/api/mobile-auth/start`.
2. Nel browser parte il normale OAuth web di Google (se il browser ha già
   una sessione del sito, Google si salta del tutto); si atterra su
   `/api/mobile-auth/finish`.
3. `finish` conia un **ticket monouso** (32 byte casuali, vita 2 minuti, in
   DB solo l'hash — tabella `LoginTicket`) e rimbalza sul deep link
   `goaltracker://login?ticket=…`. Il salto è una pagina con pulsante, non
   un 302: Chrome blocca in silenzio i redirect server-side verso schemi
   custom senza un gesto dell'utente.
4. L'intent-filter di `MainActivity` (schema `goaltracker`, host `login`)
   riporta l'app in primo piano; la pagina di login riceve il deep link
   (`@capacitor/app`: evento `appUrlOpen`, o `getLaunchUrl()` a freddo) e
   spende il ticket sul provider `ticket` di NextAuth con una fetch
   same-origin: il cookie di sessione nasce nella WebView.

Il consumo del ticket è un `DELETE … RETURNING`: atomico, il secondo
tentativo con lo stesso ticket trova la riga già sparita. Lo schema custom è
in teoria intercettabile da altre app, ma consegna solo un token spendibile
una volta entro due minuti, mai credenziali durevoli.

### Percorso di ripiego: Sign-In nativo

Il codice web è servito da Vercel e gira anche dentro APK installati prima
dei plugin `@capacitor/browser` / `@capacitor/app`: lì la pagina di login
ripiega sul Sign-In nativo (`@capgo/capacitor-social-login`). L'ID token
viene verificato server-side dal provider `google-native` in
`src/lib/auth.ts` (audience, issuer, email verificata).

**Due percorsi nativi, provati in quest'ordine.** La modalità *online* passa
dal Credential Manager e restituisce direttamente un ID token. Su alcuni
dispositivi però fallisce con `[16] Account reauth failed` anche a
configurazione OAuth corretta e verificata, e non c'è nulla lato app che possa
rimediare: è stato di Play Services sul telefono. Per questo, se l'online
fallisce (e l'utente non ha annullato), si ripiega sulla modalità *offline*,
che usa l'API di autorizzazione di Google — percorso del tutto diverso — e
restituisce un `serverAuthCode`. Il server lo scambia presso Google
(`exchangeServerAuthCode` in `src/lib/auth.ts`) e ottiene un ID token che
finisce nella stessa identica validazione dell'altro percorso.

La modalità offline richiede che `MainActivity` implementi
`ModifiedMainActivityForSocialLoginPlugin` e inoltri al plugin i risultati di
`startIntentSenderForResult`: senza, il plugin rifiuta di partire. È il motivo
per cui `android/app/src/main/java/app/vercel/goaltracker/MainActivity.java`
non è più la classe vuota generata da Capacitor — **non va rigenerata**.

### Setup necessario (una volta sola)

1. **Vercel** → env var `NEXT_PUBLIC_GOOGLE_CLIENT_ID` con lo stesso valore di
   `GOOGLE_CLIENT_ID`. Non è un segreto: è l'audience dell'ID token, il client
   nativo deve conoscerla.
2. **Google Cloud Console** → APIs & Services → Credentials → **Create
   credentials → OAuth client ID → Android**, nello stesso progetto del client
   web esistente:
   - Package name: `app.vercel.goaltracker`
   - SHA-1: quella della keystore di firma condivisa (vedi sotto)
   Non serve copiare questo client ID da nessuna parte: deve solo esistere.
3. **GitHub** → repo Settings → Secrets and variables → Actions → secret
   `ANDROID_DEBUG_KEYSTORE_B64` con la keystore condivisa in base64.

### Perché serve una keystore condivisa

I runner CI sono usa-e-getta: senza keystore fissa ogni APK esce firmato con
una chiave diversa. Conseguenze: per aggiornare l'app bisogna prima
disinstallarla, e il Sign-In di Google non funziona mai, perché la SHA-1
registrata su Google Cloud non corrisponde più alla firma dell'APK. Il
workflow ripristina la keystore dal secret prima di compilare; se il secret
manca, avvisa e firma con una chiave usa-e-getta.

È una chiave di **debug** per distribuzione personale, non la chiave di
release per il Play Store.

## Permessi

I permessi per i singoli tipi di dato arrivano dal manifest del plugin e
vengono uniti in fase di build: non vanno riscritti in
`android/app/src/main/AndroidManifest.xml`.

L'unico dichiarato dall'app è `READ_HEALTH_DATA_HISTORY`, senza il quale Health
Connect limita la lettura agli ultimi ~30 giorni. Sui provider troppo vecchi
viene ignorato senza far fallire la richiesta.

## Privacy policy

Health Connect pretende che l'app mostri un'informativa sui dati sanitari.
È in `public/privacypolicy.html` e viene copiata negli asset nativi da
`npx cap sync`; il plugin la apre quando l'utente tocca «Informativa privacy»
nel foglio dei permessi.

## Icona dell'app

L'icona del launcher deriva da **`public/icon-512.svg`**, la stessa che usava
la PWA: corona e spada su fondo scuro. Il template di Capacitor ne installa una
generica su sfondo bianco — se ricompare, è perché qualcuno ha rigenerato il
progetto nativo.

L'icona adattiva è costruita a due livelli, come vuole Android:

- **sfondo** (`mipmap-*/ic_launcher_background.png`): solo i gradienti, il
  bagliore della fucina, le stelle e l'anello runico, a pieno campo e **senza
  angoli arrotondati** — al ritaglio pensa la maschera del launcher
- **primo piano** (`mipmap-*/ic_launcher_foreground.png`): corona e spada su
  trasparente, ridimensionate perché il loro ingombro reale riempia la zona
  sicura (72dp su 108), non semplicemente rimpicciolendo tutta la tela

Restano anche `ic_launcher.png` e `ic_launcher_round.png` in tutte le densità,
usate dai launcher che non supportano le icone adattive; la seconda è la stessa
arte ritagliata a cerchio.

Per rigenerarle serve un rasterizzatore: le PNG attuali sono state prodotte
dall'SVG con Chromium headless pilotato da Playwright, controllando la viewport
in modo esatto. Attenzione se si usa `chrome --screenshot` a mano: la finestra
headless riserva un centinaio di pixel al proprio ingombro e le immagini
escono **tagliate in basso** senza alcun errore.

## File rigenerati

`android/app/src/main/assets/public/` e i due `capacitor.*.json` accanto sono
copie di `public/` prodotte da `npx cap sync android`, quindi sono in
`.gitignore`. Dopo un clone pulito lancia `npx cap sync android` prima di
`./gradlew`.

## Notifiche push: perché nell'APK non arrivano

Le notifiche dell'app usano il Web Push standard (VAPID + service worker).
Funziona nel browser, **non dentro l'APK**: il WebView di Android non espone
l'API Push del browser, quindi `PushSubscriber` trova `PushManager`
mancante e si ferma senza registrarsi. Non è un guasto e non c'è flag da
attivare: quel pezzo di piattaforma nel WebView non c'è.

La via nativa è **Firebase Cloud Messaging**, che è anche il trasporto che
Chrome usa sotto per il Web Push su Android — cambia solo chi tiene la
connessione: il sistema operativo invece della pagina.

### Configurato — cosa resta da fare a mano

Il progetto Firebase esiste (`goal-tracker-16222`), `google-services.json` è
in `android/app/` ed è committato: **non è un segreto**, viaggia dentro ogni
APK e chiunque scarichi l'app ce l'ha.

Il segreto è l'altro: **la chiave dell'account di servizio**, che serve al
server per inviare. Va su Vercel come variabile d'ambiente, non nel repo:

1. Firebase → **Impostazioni progetto → Account di servizio → Genera nuova
   chiave privata** (scarica un JSON).
2. Vercel → Settings → Environment Variables → nuova variabile
   **`FIREBASE_SERVICE_ACCOUNT`**, e come valore **l'intero contenuto del
   JSON** incollato così com'è, su una riga sola.
3. Redeploy.

Senza quella variabile il codice non si rompe: `getMessaging()` restituisce
null, gli invii verso l'APK falliscono in silenzio e il Web Push del browser
continua a funzionare come prima.

### Come si prova

Profilo Eroe → Notifiche → **Attiva notifiche push** (dentro l'APK parte il
percorso nativo, non quello del browser), poi **Invia test**. La risposta
dice `sent`, `total`, `fcm` e `fcmReady`: se `fcm: 1` e `fcmReady: false`, la
variabile su Vercel manca o è malformata.

### La SHA-1: per FCM non serve

Nel modulo di Firebase c'è il campo impronta SHA-1 ed è rimasto vuoto — si
vede da `oauth_client: []` dentro `google-services.json`. **Per le notifiche
non cambia nulla**: l'impronta serve a Firebase Authentication, ai Dynamic
Links e ad App Check, non a Cloud Messaging, che identifica l'app col nome
pacchetto e la chiave API. Il Sign-In di Google dell'app non passa da
Firebase, quindi resta com'è. Se un giorno lo si sposterà lì, allora l'SHA-1
andrà aggiunta e il file rigenerato.

### Cosa serviva, prima di scrivere una riga di codice

FCM richiede un file di configurazione legato al progetto Firebase e al
nome del pacchetto. Senza, il plugin Gradle di Google fa fallire la build
dell'APK — quindi il lavoro non si può nemmeno iniziare a metà.

1. **console.firebase.google.com** → crea un progetto (o riusa quello del
   client OAuth, se ne hai già uno).
2. **Aggiungi un'app Android** con package name esatto:
   `app.vercel.goaltracker`
3. Aggiungi la **SHA-1 della keystore condivisa** (la stessa registrata su
   Google Cloud per il Sign-In; vedi sopra).
4. Scarica **`google-services.json`** e mettilo in `android/app/`.
5. **Project settings → Cloud Messaging** → genera una chiave privata di
   servizio: è quella che il server userà per inviare, al posto delle
   chiavi VAPID.

### Cosa cambierà nel codice, quando il file ci sarà

- `@capacitor/push-notifications` nel guscio: chiede il permesso, ottiene
  il token FCM del dispositivo e lo manda a `/api/push/subscribe` accanto
  (non al posto) delle subscription web esistenti;
- `PushSubscription` guadagna una colonna per distinguere le due sorti,
  perché il browser continuerà a usare il Web Push;
- l'invio si sdoppia: `web-push` per le subscription del browser, l'SDK
  Firebase Admin per i token FCM. Il cron dei promemoria non cambia: cambia
  solo il corriere.

Finché il file non c'è, l'APK resta senza notifiche e il browser continua a
riceverle normalmente.

## Problemi frequenti

**«Health Connect non è installato»** — installalo dal Play Store; su Android
13 e precedenti non è di sistema.

**Permessi concessi ma nessun dato** — controlla che Samsung Health stia
scrivendo su Health Connect (Samsung Health → Impostazioni → Health Connect) e
che il Fit3 abbia sincronizzato di recente.

**Solo gli ultimi 30 giorni** — è il comportamento predefinito di Health
Connect senza `READ_HEALTH_DATA_HISTORY`; su provider vecchi il permesso non
esiste e il limite resta.

**Login che si perde riaprendo l'app** — il guscio usa la stessa sessione
NextAuth della PWA; se si perde, verifica che `NEXTAUTH_URL` su Vercel
corrisponda all'URL in `capacitor.config.ts`.
