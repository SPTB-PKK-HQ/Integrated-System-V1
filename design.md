# Design Document: Sistem Bersepadu SPTB (HQ) — Aplikasi Android Native

> **Versi:** 1.0
> **Tarikh:** 16 Julai 2026
> **Platform Sasaran:** Android Native (Kotlin, Jetpack Compose)
> **API Minimum:** Android 8.0 (API 26)
> **API Sasaran:** Android 15 (API 35)

---

## 1. Ringkasan Sistem

Sistem Bersepadu SPTB (HQ) adalah sistem pengurusan permohonan kontraktor di bawah KUSKOP. Sistem sedia ada adalah web app (HTML/CSS/JS + Google Apps Script). Dokumen ini menggariskan reka bentuk untuk membina semula sistem sebagai aplikasi Android native setaraf aplikasi moden.

**Fungsi teras:**
- Pengurusan permohonan kontraktor (BARU/PEMBAHARUAN/UBAH MAKLUMAT/UBAH GRED)
- Aliran kerja pengesahan & kelulusan (PENGESYOR > PELULUS)
- Semakan dokumen berasaskan AI (OCR PDF)
- Papan pemuka analisis & laporan (Chart.js style)
- Sistem notifikasi & inbox
- Pengurusan dokumen Google Drive
- Penjadualan WhatsApp automatik
- PKA workflow (SPI siasatan)

**User Roles:** PENGESYOR, PELULUS, PENGARAH, KETUA_SEKSYEN, ADMIN, PKA

---

## 2. Seni Bina Aplikasi

### 2.1 Pattern: MVVM + Clean Architecture

```
+---------------------------------------------------+
|                    UI Layer                         |
|  Jetpack Compose (Material 3 / Material You)       |
|  Screens / Components / Navigation (NavHost)       |
+---------------------------------------------------+
|                  ViewModel Layer                    |
|  StateFlow / Compose State                         |
|  Business logic coordination                       |
+---------------------------------------------------+
|                  Domain Layer                       |
|  UseCases / Repository Interfaces                  |
|  Entity models                                     |
+---------------------------------------------------+
|                   Data Layer                        |
|  Repositories / DataSources                         |
|  (Local: Room DB, DataStore)                       |
|  (Remote: Retrofit/Firebase/Google APIs)           |
|  (Sync: WorkManager)                               |
+---------------------------------------------------+
```

### 2.2 Struktur Modul (Feature-first)

```
app/
+-- core/                    # Asas: network, database, DI, theme
|   +-- di/                  # Hilt DI modules
|   +-- network/             # Retrofit, interceptors
|   +-- database/            # Room database, DAOs
|   +-- datastore/           # Preferences DataStore
|   +-- ui/                  # Tema Material 3, komponen sepunya
|   +-- util/
+-- auth/                    # Log masuk & autentikasi
+-- dashboard/               # Papan pemuka analisis
+-- formchecker/             # Borang Semakan + AI PDF
+-- application/             # Input Database / permohonan
+-- approver/                # Pelulus view & action
+-- list/                    # Senarai permohonan
+-- admin/                   # Admin dashboard & users
+-- pka/                     # PKA workflow (SPI)
+-- inbox/                   # Inbox & notifikasi
+-- basket/                  # Bakul permohonan
+-- excel/                   # Tapisan Excel
+-- history/                 # Sejarah keputusan
+-- drive/                   # File Manager / Google Drive
+-- whatsapp/                # Penjadualan WhatsApp
+-- settings/                # Tetapan aplikasi
```

---

## 3. Ciri-ciri Android Native

### 3.1 Autentikasi & Biometrik (Fingerprint)

**Flow log masuk:**

1. **Pertama kali:** Log masuk guna akaun Google (Credential Manager API)
2. **Kali kedua & seterusnya:** Pengesahan biometrik (fingerprint/face unlock) menggunakan **Android BiometricPrompt**:
   - Token sesi disimpan dalam **EncryptedSharedPreferences** (Android Keystore)
   - Token disahkan setiap kali app dibuka
   - Jika gagal biometrik 3 kali, fallback ke log masuk Google semula
3. **Log keluar:** Padam token, paksa log masuk semula

```kotlin
// Pseudokod BiometricPrompt
val biometricPrompt = BiometricPrompt(
    this,
    object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result) {
            // Buka app
        }
    }
)
val promptInfo = BiometricPrompt.PromptInfo.Builder()
    .setTitle("Log Masuk Sistem Bersepadu")
    .setSubtitle("Sahkan identiti anda")
    .setNegativeButtonText("Guna Google Sign-In")
    .setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
    .build()
biometricPrompt.authenticate(promptInfo)
```

**State diagram:**

```
[App Dibuka]
    |
[Ada token sah?]
    +-- Ya --> [Prompt Biometrik]
    |           +-- Berjaya --> [Dashboard]
    |           +-- Gagal/3x --> [Skrin Log Masuk Google]
    +-- Tidak --> [Skrin Log Masuk Google]
```

### 3.2 Notifikasi Push (FCM)

**Senario notifikasi:**

| Jenis | Pencetus | Kandungan |
|-------|----------|-----------|
| Permohonan baru | Pengesyor hantar syor | "Permohonan [Syarikat] menunggu kelulusan anda" |
| Keputusan pelulus | Pelulus lulus/tolak | "Permohonan [Syarikat] telah [LULUS/TOLAK]" |
| Peringatan SLA | Sistem (WorkManager periodic) | "X permohonan menghampiri due date" |
| Peringatan lawatan | PKA dijadualkan | "Lawatan [Syarikat] esok" |
| WhatsApp auto | Jadual WhatsApp trigger | "Mesej WhatsApp telah dihantar ke [Syarikat]" |

**Implementation:**
- **Firebase Cloud Messaging (FCM)** untuk push notification
- **NotificationChannel** per kategori (permohonan, kelulusan, peringatan)
- **NotificationCompat** dengan Android 13+ runtime permission (POST_NOTIFICATIONS)
- Notifikasi klik -> deep link ke screen spesifik (Navigation Compose deep link)
- **WorkManager** untuk scheduled tasks (cron-like: generate daily report, check SLA)

### 3.3 Deep Links & App Links

Setiap screen boleh diakses melalui deep link:
- `sptb://dashboard`
- `sptb://application/{id}`
- `sptb://approval/{id}`
- `sptb://inbox`
- `sptb://pka/inbox`

Notifikasi FCM mengandungi deep link untuk redirect pengguna ke screen berkaitan.

### 3.4 Offline-First (Data Sync)

**Strategy:**
1. **Room database** sebagai single source of truth (local first)
2. Data dari API disimpan ke Room, kemudian dipaparkan
3. Semua operasi tulis melalui repository (tulis ke Room -> sync ke remote)
4. **WorkManager** untuk background sync (periodic + on-demand)
5. **ConnectivityMonitor** menggunakan NetworkCallback untuk trigger sync bila online

**Caching strategy:**
- Master data (users, roles): cache 1 jam
- Application list: cache 30 minit, refresh ditarik ke atas (pull-to-refresh)
- Dashboard stats: cache 15 minit
- PDF documents: cache tempatan (Android internal storage)

### 3.5 PDF & AI Integration

- **PDF Viewer:** Gunakan AndroidPdfViewer atau muat turun PDF ke storage dan buka dengan Intent
- **AI OCR:** Hantar PDF ke backend (Google Apps Script) yang menggunakan DeepSeek/Gemini API
- **Progress:** Upload progress bar menggunakan multipart upload dengan Retrofit

### 3.6 Google Drive Integration

- Gunakan **Google Drive API (v3)** dengan OAuth 2.0
- List files, upload, download, create folder
- File picker menggunakan **ActivityResultContracts** (ACTION_OPEN_DOCUMENT, ACTION_CREATE_DOCUMENT)
- Simpan folder ID dalam Room untuk akses pantas

### 3.7 WhatsApp Integration

- **Deep link** ke WhatsApp: `https://wa.me/60XXXXXXXXX?text=...`
- Atau guna **WhatsApp Business API** jika integrasi rasmi diperlukan
- Penjadualan: WorkManager dengan flex interval untuk trigger hantar mesej pada waktu ditetapkan

### 3.8 Google Maps & GIS

- **Maps Compose** (Maps SDK for Android) dalam aplikasi
- Marker untuk lokasi syarikat
- Autocomplete lokasi menggunakan Places API
- Street View untuk lawatan maya

### 3.9 Analytics Charts

- Gunakan pustaka seperti **Vico** atau **MPAndroidChart** (Compatible)
- Graf: bar, line, pie, donut
- Animasi smooth, interactive touch
- CSV export function

---

## 4. UI/UX Design (Material Design 3)

### 4.1 Design Principles

1. **Material You (Material 3)** - dynamic color theming
2. **Consistent typography** - font system Malaysia (atau guna default M3)
3. **Responsive layout** - tablet support (adaptive layout)
4. **Dark mode** - sokongan light/dark theme
5. **Accessibility** - content description, font scaling, talkback
6. **Bahasa Malaysia** - semua UI dalam Bahasa Malaysia

### 4.2 Screen Flow

```
[Splash Screen] --> [Auth Screen]
                        |
                   [Log Masuk Google]
                        |
                   [Prompt Biometrik]
                        |
                   [Dashboard] (Home)
                        |
        +---------------+----------------+
        |               |                |
   [Senarai]       [Borang Baru]    [Inbox]
        |               |                |
   [Detail App]    [Input DB]      [Notifikasi]
        |               |
   [Kelulusan]    [Cetak/PDF]
```

### 4.3 Navigation

- **Bottom Navigation Bar** untuk tab utama: Dashboard, Senarai, Borang, Inbox, Lagi
- **Navigation Rail** untuk tablet
- **Drawer** untuk menu sekunder (Admin, PKA, Settings, History)
- **Back navigation** guna NavHost default back stack

### 4.4 Key Screens

| Screen | Description |
|--------|-------------|
| Splash Screen | Logo KUSKOP/SPTB, loading data |
| Auth Screen | Google Sign-In button + biometric prompt |
| Dashboard | Stats cards, trend charts, status donut |
| Application List | Filterable, searchable list with status badges |
| Application Form | Full form dengan AI PDF extraction |
| Profile Screen | Company profile with Google Maps |
| Approver View | Summary + approval decision form |
| Admin Dashboard | Full stats, user management table |
| PKA Dashboard | SPI inbox, keputusan, sejarah |
| Inbox | Notification list with batch actions |
| Bakul | Saved applications from Excel screening |
| Settings | Profile, theme, notification prefs, volume |

---

## 5. Teknologi Stack

### 5.1 Android

| Komponen | Pustaka |
|----------|---------|
| UI | Jetpack Compose + Material 3 |
| Navigation | Navigation Compose |
| DI | Hilt (Dagger Hilt) |
| Network | Retrofit + OkHttp + Kotlinx Serialization |
| Database | Room (SQLite) |
| Preferences | DataStore Preferences & EncryptedSharedPreferences |
| Image Loading | Coil (Compose-native) |
| Biometric | AndroidX Biometric |
| Push Notif | Firebase Cloud Messaging |
| Background Work | WorkManager |
| Maps | Google Maps Compose + Places API |
| Charts | Vico (Compose chart library) |
| PDF Viewing | AndroidPdfViewer / PDF.js via WebView |
| Crash Report | Firebase Crashlytics |
| Logging | Timber |

### 5.2 Backend (Existing)

| Komponen | Teknologi |
|----------|-----------|
| API Gateway | Google Apps Script (code.gs) |
| Database | Google Sheets + Firestore |
| Auth | Firebase Auth + Google Identity Services |
| Storage | Firebase Storage + Google Drive |
| AI | DeepSeek API / Gemini API / OpenRouter API |
| Email | Apps Script MailApp |
| File Upload | Apps Script Blob/DriveApp |

### 5.3 Backend (Suggested Upgrade)

Untuk aplikasi Android yang scalable, pertimbangkan backend baru:

| Komponen | Pilihan |
|----------|---------|
| API Server | Kotlin (Ktor) / Node.js (Express) / Python (FastAPI) |
| Database | PostgreSQL / Firebase Firestore |
| Auth API | JWT token-based |
| File Storage | Google Cloud Storage / Firebase Storage |
| Push Notif | Firebase Admin SDK |
| Cron/Jobs | Cloud Tasks / Cloud Scheduler |

---

## 6. Integrasi API

### 6.1 Endpoint Utama (Backend sedia ada via Google Apps Script)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/exec?action=getData` | GET | Ambil semua data permohonan |
| `/exec?action=getUsers` | GET | Ambil senarai pengguna |
| `/exec?action=getDashboard` | GET | Data dashboard statistik |
| `/exec?action=submitForm` | POST | Hantar borang permohonan baru |
| `/exec?action=approve` | POST | Hantar keputusan pelulus |
| `/exec?action=extractPdf` | POST | Ekstrak PDF guna AI |
| `/exec?action=sendEmail` | POST | Hantar emel notifikasi |
| `/exec?action=createDriveFolder` | POST | Cipta folder Drive |
| `/exec?action=getHistory` | GET | Ambil sejarah keputusan |
| `/exec?action=manageUser` | POST | Tambah/edit/padam pengguna |

### 6.2 Google APIs

- **Google Sign-In API** (Credential Manager)
- **Google Drive API v3** (list, upload, download, create folder)
- **Google Maps SDK & Places API** (maps, autocomplete, geocoding)
- **Google Sheets API** (direct read/write option)

### 6.3 Firebase

- **Firebase Auth** (Google sign-in)
- **Firebase Firestore** (real-time data, basket)
- **Firebase Cloud Messaging** (push notifications)
- **Firebase Crashlytics** (crash reporting)
- **Firebase Performance** (monitoring)

---

## 7. Keselamatan

### 7.1 Data at Rest

- API keys disimpan dalam **BuildConfig** (NDK) atau **Firebase Remote Config**
- Token autentikasi dalam **EncryptedSharedPreferences** (AES-256)
- Data sensitif (IC, telefon) dalam **Room** dengan **SQLCipher** (encrypted database)
- Gambar tandatangan & cop disimpan dalam app-internal storage

### 7.2 Data in Transit

- Semua API call guna HTTPS
- Certificate pinning (OkHttp CertificatePinner) untuk Apps Script endpoint
- OAuth 2.0 untuk Google APIs

### 7.3 App Security

- **ProGuard/R8** untuk obfuscation
- **Android App Bundle** untuk distribution
- **SafetyNet Attestation / Play Integrity API** untuk verify device integrity
- Root detection (basic)
- **SSL Pinning**

---

## 8. Prestasi

### 8.1 Optimisasi

- **Paging 3** untuk list yang besar (senarai permohonan)
- **Lazy Column/Grid** Compose untuk scroll performance
- **Image caching** dengan Coil (memory + disk cache)
- **Database indexing** pada field yang selalu di-query (status, tarikh, CIDB)
- **Data pre-fetch** pada splash screen (muat turun master data)

### 8.2 Background Tasks

| Task | Frequency | Worker |
|------|-----------|--------|
| Sync data dengan server | Every 30 min (when online) | WorkManager Periodic |
| Check SLA deadlines | Every 6 hours | WorkManager |
| Send scheduled WhatsApp | On-demand + scheduled | WorkManager OneTime |
| Generate daily report | Daily at 5pm | WorkManager |
| Clean old cache | Weekly | WorkManager |
| Refresh FCM token | On token change | FirebaseMessagingService |

---

## 9. Keperluan Pematuhan

### 9.1 Android Requirements

- **Minimum SDK:** 26 (Android 8.0) - coverage >95%
- **Target SDK:** 35 (Android 15)
- **Permissions:**
  - `INTERNET` - network access
  - `POST_NOTIFICATIONS` (Android 13+) - push notifications
  - `USE_BIOMETRIC` - fingerprint login
  - `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` - Google Maps
  - `READ_EXTERNAL_STORAGE` (Android 12-) / `READ_MEDIA_IMAGES` (Android 13+) - file upload
  - `CAMERA` (optional) - scan dokumen

### 9.2 Google Play Requirements

- **App Signing** by Google Play
- **Content Rating:** Everyone (or Teen)
- **Privacy Policy** - perlu nyatakan data apa dikumpul
- **Data Safety** section dalam Play Console

---

## 10. Pelaksanaan & Milestone

### Fasa 1: Foundation (4 minggu)

- [ ] Setup project (Gradle, Hilt, Compose, Room)
- [ ] Navigation structure (NavHost)
- [ ] Tema Material 3 (light/dark)
- [ ] Auth module (Google Sign-In + BiometricPrompt)
- [ ] FCM integration
- [ ] Data layer (Room entities, DAOs, Retrofit service)
- [ ] Shared preferences module

### Fasa 2: Core Features (6 minggu)

- [ ] Dashboard screen (stat cards, charts)
- [ ] Application list with search/filter
- [ ] Form checker (Borang Semakan)
- [ ] Input DB (Application form submission)
- [ ] Approver view & action
- [ ] Google Maps integration
- [ ] Google Drive file manager
- [ ] AI PDF extraction flow

### Fasa 3: Advanced Features (4 minggu)

- [ ] Inbox & notification system
- [ ] PKA dashboard (SPI workflow)
- [ ] Admin dashboard & user management
- [ ] History screen
- [ ] Excel tapisan & bakul
- [ ] WhatsApp scheduling
- [ ] Print/PDF generation
- [ ] Settings screen

### Fasa 4: Polishing (4 minggu)

- [ ] Offline sync optimization
- [ ] Performance tuning
- [ ] Tablet layout (adaptive)
- [ ] Dark mode polish
- [ ] Accessibility audit
- [ ] Security hardening
- [ ] Play Store listing preparation
- [ ] Beta testing (internal + closed track)

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Google Apps Script API rate limit | Cache agresif, retry mechanism, fallback ke Firebase |
| Network dependency (offline) | Offline-first architecture dengan Room sync |
| PDF size besar | Muat naik chunked, progress indicator |
| Biometric tidak tersedia | Fallback ke PIN/pattern atau Google Sign-In |
| Android fragmentation | Target API 26+, Compose compatible, extensive device testing |
| Data migration dari web | Re-adapt API response, versioned Room migration |

---

## 12. Appendix

### A. Reference Repository Structure

```
SistemBersepaduAndroid/
+-- app/
|   +-- src/
|       +-- main/
|           +-- java/com/kuskop/sptb/
|           |   +-- SptbApplication.kt
|           |   +-- MainActivity.kt
|           |   +-- core/
|           |   |   +-- di/
|           |   |   +-- network/
|           |   |   +-- database/
|           |   |   +-- datastore/
|           |   |   +-- ui/ (theme, components)
|           |   |   +-- util/
|           |   +-- feature/
|           |       +-- auth/
|           |       +-- dashboard/
|           |       +-- formchecker/
|           |       +-- ...
|           +-- res/
|           +-- AndroidManifest.xml
+-- build.gradle.kts (project)
+-- build.gradle.kts (app)
+-- gradle/
+-- settings.gradle.kts
```

### B. Dependencies (build.gradle.kts)

```kotlin
// Core
implementation("androidx.core:core-ktx:1.13.1")
implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
implementation("androidx.activity:activity-compose:1.9.3")

// Compose BOM
implementation(platform("androidx.compose:compose-bom:2024.12.01"))
implementation("androidx.compose.ui:ui")
implementation("androidx.compose.material3:material3")
implementation("androidx.compose.ui:ui-tooling-preview")
implementation("androidx.compose.material:material-icons-extended")

// Navigation
implementation("androidx.navigation:navigation-compose:2.8.5")

// Hilt
implementation("com.google.dagger:hilt-android:2.52")
kapt("com.google.dagger:hilt-android-compiler:2.52")
implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

// Room
implementation("androidx.room:room-runtime:2.6.1")
implementation("androidx.room:room-ktx:2.6.1")
kapt("androidx.room:room-compiler:2.6.1")

// Network
implementation("com.squareup.retrofit2:retrofit:2.11.0")
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

// Firebase
implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
implementation("com.google.firebase:firebase-messaging-ktx")
implementation("com.google.firebase:firebase-auth-ktx")
implementation("com.google.firebase:firebase-firestore-ktx")

// Google
implementation("com.google.android.gms:play-services-auth:21.2.0")
implementation("com.google.android.gms:play-services-maps:19.0.0")
implementation("com.google.maps.android:maps-compose:6.4.1")
implementation("com.google.android.libraries.places:places:4.1.0")

// Biometric
implementation("androidx.biometric:biometric:1.2.0-alpha05")

// Charts
implementation("com.patrykandpatrick.vico:compose:2.0.0-beta.2")

// DataStore
implementation("androidx.datastore:datastore-preferences:1.1.1")
// Encrypted SharedPrefs
implementation("androidx.security:security-crypto:1.1.0-alpha06")

// WorkManager
implementation("androidx.work:work-runtime-ktx:2.9.1")

// Paging
implementation("androidx.paging:paging-runtime-ktx:3.3.5")
implementation("androidx.paging:paging-compose:3.3.5")

// Image Loading
implementation("io.coil-kt:coil-compose:2.7.0")

// PDF Viewer
implementation("com.github.barteksc:android-pdf-viewer:3.2.0-beta.1")
// OR use PDF.js in WebView for more flexibility

// Crashlytics
implementation("com.google.firebase:firebase-crashlytics-ktx")
```
