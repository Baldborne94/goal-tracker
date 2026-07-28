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
(`disallowed_useragent`), quindi dentro l'APK non si usa il redirect di
NextAuth: la pagina di login rileva il nativo e apre il **Sign-In nativo di
Google** (`@capgo/capacitor-social-login`). L'ID token risultante viene
verificato server-side dal provider `google-native` in `src/lib/auth.ts`
(audience, issuer, email verificata) e la sessione nasce da una fetch
same-origin, quindi il cookie finisce nella WebView senza problemi di
isolamento delle Custom Tab.

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

## File rigenerati

`android/app/src/main/assets/public/` e i due `capacitor.*.json` accanto sono
copie di `public/` prodotte da `npx cap sync android`, quindi sono in
`.gitignore`. Dopo un clone pulito lancia `npx cap sync android` prima di
`./gradlew`.

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
