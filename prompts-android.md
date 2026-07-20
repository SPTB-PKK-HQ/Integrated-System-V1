# Prompt untuk Google AI Studio / Gemini — Jana Kod Android

Guna prompt di bawah satu per satu di https://aistudio.google.com/ untuk hasilkan kod Kotlin Jetpack Compose bagi setiap tab.

> Andaian: Projek Android sedia ada dengan Hilt, Room, Retrofit, Navigation Compose.
> Gantikan PACKAGE_NAME dengan com.kuskop.sptb.

---

## Prompt 1: Auth Module (Log Masuk + Biometrik)

You are an expert Android developer. Generate a complete auth module in Kotlin using Jetpack Compose, Hilt, Credential Manager API, and Android BiometricPrompt for an app called Sistem Bersepadu SPTB.

Requirements:
1. LoginScreen.kt with Google Sign-In button using Credential Manager API.
2. After first login, save auth token to EncryptedSharedPreferences (Android Keystore).
3. On subsequent app opens, check for saved token. If exists, show BiometricPrompt (fingerprint/face unlock). If not, show Google Sign-In.
4. If biometric fails 3 times or user clicks negative button, fallback to Google Sign-In.
5. BiometricPrompt screen with app logo, title "Log Masuk Sistem Bersepadu", subtitle "Sahkan identiti anda".
6. AuthViewModel with sealed class AuthState: Loading, Authenticated(User), NeedsBiometric, NeedsGoogleSignIn, Error(message).
7. Navigation: if token exists -> BiometricPrompt -> Dashboard. If no token -> GoogleSignInScreen -> BiometricPrompt -> Dashboard.
8. Use Material 3 design, Bahasa Malaysia text throughout.
9. Logout function that clears EncryptedSharedPreferences token and navigates back to login.
10. Handle configuration changes properly.

Package: com.kuskop.sptb.feature.auth

## Prompt 2: Dashboard Screen

Generate a Dashboard screen in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ).

Requirements:
1. Top section: 5 stat cards in a row (Jumlah, SOKONG, TIDAK DISOKONG, Dalam Proses, Dokumen Tak Lengkap) with different accent colors, animated counting numbers.
2. Charts section using Vico Compose library:
   - Line chart for monthly trend
   - Donut chart for status breakdown
   - Bar chart for application types
   - Bar chart for consultation types (Emel/WhatsApp/Call)
3. Filter bar: period dropdown (Harian/Bulanan/Tahunan), year dropdown, month dropdown (conditional).
4. Detailed analysis table: Bulan, Jumlah, SOKONG, TIDAK DISOKONG, Dalam Proses, Kadar Sokongan.
5. Export CSV button that saves to Downloads folder.
6. Pull-to-refresh using Accompanist or Material 3 pullRefresh.
7. User info banner showing current role (Pengesyor/Pelulus/Admin).
8. ViewModel fetches data from repository, caches in Room, refreshes periodically with WorkManager.
9. Loading state with skeleton shimmer cards.
10. Material 3 dynamic colors, Bahasa Malaysia, RTL support optional.

Package: com.kuskop.sptb.feature.dashboard

---

## Prompt 3: Form Checker (Borang Semakan + AI PDF)

Generate a Form Checker screen in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ). This is a complex multi-section form for checking contractor applications.

Requirements:

Section 1 - AI PDF Upload:
- Circular upload area with animated SVG morph ring showing progress percentage
- AI model selector dropdown: Auto, DeepSeek, Gemini, OpenRouter
- Drag-and-drop or file picker for PDF files
- After extraction, show extracted data card with Apply/Cancel buttons
- Upload progress toast/progress bar

Section 2 - Application Type:
- Radio group: BARU, PEMBAHARUAN, UBAH MAKLUMAT, UBAH GRED
- Conditional text fields appear for UBAH MAKLUMAT and UBAH GRED

Section 3 - Basic Info:
- Tarikh Mohon (date picker)
- Semakan Tatatertib dropdown (ADA/TIADA)
- Justifikasi Lawatan text input
- No Telefon text input
- Nama Syarikat, No CIDB
- Gred dropdown (G1-G7)
- Tempoh SPKK, Tempoh STB

Section 4 - SSM & Bank:
- Tarikh e-Info SSM, Status Semakan SSM (with tick/cross quick buttons)
- Tarikh Surat Bank, Syarat Bank, Status Semakan Bank (tick/cross)

Section 5 - Personnel:
- Dynamic personnel list with Add/Remove buttons
- Each person: Nama text, Jawatan checkboxes (ALP/PE/TT/PDS), Dokumen checkboxes (IC/SB/EPF)
- Semak Cepat button opens QuickCheck bottom sheet modal

Section 6 - Dokumen & KWSP:
- Status inputs for Carta, Peta, Gambar, Sewa (each with tick/cross buttons)
- 3 KWSP month entries: date picker + status input with tick/cross

Section 7 - Proses & Syor:
- Tarikh Dokumen Lengkap, Tarikh Siasatan, Tarikh Proses (auto-calculated)
- Keputusan Syor dropdown: SOKONG, SIASAT, TIDAK DISOKONG

Bottom bar: Reset button, Print button, Save & Go to Input DB button.

Form state must persist across configuration changes using ViewModel + SavedStateHandle.

Package: com.kuskop.sptb.feature.formchecker

---

## Prompt 4: Input Database (Permohonan + Google Drive)

Generate the Input Database screen in Kotlin Jetpack Compose for submitting applications in Sistem Bersepadu SPTB (HQ).

Requirements:

1. AI PDF Profile Extraction section (reuse upload component from Form Checker) for auto-filling company profile.

2. Company Profile form:
   - Nama Syarikat, No CIDB, Gred, Jenis (BARU/PEMBAHARUAN/UBAH MAKLUMAT/UBAH GRED)
   - Negeri dropdown (all 16 Malaysian states/territories)
   - Tarikh Surat, Start Date
   - Nama Pemohon, Jawatan, No IC, No Telefon, Emel
   - Alamat Berdaftar, Alamat Surat-menyurat (with checkboxes to copy from SSM)
   - No Telefon Syarikat, No Fax, Emel Syarikat, Web Address
   - Jenis Pendaftaran (ROC/ROB), Tarikh Daftar

3. Google Drive section:
   - Checkbox to auto-create company folder in Drive
   - Status indicator: Idle, Creating, Created (with link), Failed
   - Create Drive Folder button
   - Drive folder link displayed with copy-to-clipboard

4. Consultation Type checkboxes with date pickers:
   - Emel, WhatsApp, Panggilan Telefon
   - Due Date (SLA) field highlighted in red

5. WhatsApp Scheduling (toggle expand):
   - Tarikh Hantar date picker, Masa hour dropdown (8-17)
   - Mesej textarea for custom message

6. Google Maps section:
   - Textarea for Alamat Perniagaan
   - Maps Compose component showing the address pin
   - Refresh Maps button that geocodes the address

7. Approval section:
   - Tatatertib STB dropdown, Syor Lawatan dropdown (YA/TIDAK/PEMUTIHAN)
   - Date Submit to SPI
   - Lawatan section (conditional): Tarikh Lawatan, Date Submit SPTB, Syor SPI, Ulasan SPI
   - Nama Pengesyor (auto-filled from logged-in user, read-only)
   - Syor dropdown: SOKONG/TIDAK DISOKONG
   - Confirm checkbox: "Dengan ini saya mengesahkan..."
   - Pelulus selector: buttons to select approver (for WhatsApp notification)

8. Bottom actions: Back to Form, Save & Send to Sheet.
9. Form state persistence in ViewModel.

Package: com.kuskop.sptb.feature.application

---

## Prompt 5: Senarai (Application List)

Generate an Application List screen in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ).

Requirements:
1. Tab-like filter bar at top for application type: SEMUA, BARU, PEMBAHARUAN, UBAH MAKLUMAT, UBAH GRED, HANTAR KE SPI. Each button shows count badge.
2. Submitted items filter section: SEMUA, LULUS, TOLAK, PENDING with count badges.
3. Filter by Pengesyor name (dynamic buttons generated from data).
4. Month and Year dropdown filters.
5. Search box with debounce for searching company name or CIDB.
6. LazyColumn of application cards, each showing:
   - Company name, CIDB, Grade badge
   - Application type, status chip (colored)
   - Tarikh Mohon, Pengesyor name
   - Click to open detail/approval screen
7. Pull-to-refresh.
8. Pagination using Paging 3 Compose.
9. ViewModel with search/filter/sort state, cached in Room.

Package: com.kuskop.sptb.feature.list

---

## Prompt 6: Paparan Pelulus (Approver View & Action)

Generate the Approver View and Approver Action screens in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ).

Requirements:

Part A - Approver View screen:
1. Application summary card with all fields displayed read-only:
   - Company details, grade, application type
   - Personnel table
   - Document status table
   - KWSP status
   - Syor info (Pengesyor, Tarikh, Status)
2. Print button for form PDF
3. Ke Keputusan button to navigate to Approver Action

Part B - Approver Action screen:
1. Application summary header (collapsible, shows company name, CIDB, grade, current syor)
2. Keputusan dropdown: LULUS, LULUS BERSYARAT, PEMUTIHAN, TOLAK, TOLAK & BEKU 3 BULAN, TOLAK & BEKU 6 BULAN
3. Conditional Alasan dropdown when decision is TOLAK: Dokumen tidak lengkap, Tidak memenuhi PK1.5, Gagal lawatan premis, Pemalsuan Dokumen
4. Catatan Pelulus textarea
5. Tukar Syor Lawatan section (optional): dropdown with justification text field, Date Submit to SPI
6. Confirm checkbox untuk pengesahan
7. Nama Pelulus auto-filled read-only
8. Hantar Keputusan button with confirmation dialog
9. Back button to return to view

Navigation: List -> Approver View -> Approver Action -> Success -> List

Package: com.kuskop.sptb.feature.approver

---

## Prompt 7: Admin Dashboard

Generate an Admin Dashboard screen in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ). Admin-only access.

Requirements:

1. Stats overview: 5 cards showing JUMLAH KESELURUHAN, LULUS, TOLAK, DALAM PROSES, DOKUMEN TIDAK LENGKAP.
2. Pengesyor Statistics section with table and chart toggle:
   - Table: Pengesyor, Jumlah Syor, SOKONG, TIDAK DISOKONG, Kadar Sokongan
   - Bar chart version of same data
3. Pelulus Statistics section with table and chart toggle:
   - Table: Pelulus, Jumlah Diproses, LULUS, TOLAK, Kadar Kelulusan
   - Bar chart version
4. Monthly trends chart.
5. Analysis by application type table.
6. Rejection reason analysis table.
7. Incomplete documents by grade table.
8. Deleted records log table with refresh button.
9. User management section:
   - Table: Nama, Email, Role, Firebase Code, Telefon, Tandatangan, Cop, Actions (Edit/Delete)
   - Add User button opens modal
   - User form modal: Nama, Email, Role dropdown, Warna, Telefon, Firebase Code
10. Archive Year button for annual data archival.
11. Firebase Code cleanup button.
12. CSV export and Print report buttons.
13. Month/year filter bar.

Package: com.kuskop.sptb.feature.admin

---

## Prompt 8: PKA Dashboard (SPI Workflow)

Generate the PKA Dashboard screens (Dashboard, Inbox, Keputusan, Sejarah) in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ). PKA role access.

Requirements:

Tab 1 - PKA Dashboard:
2 stat cards: Di SPI count, Selesai Lawatan count.

Tab 2 - PKA Inbox:
1. Filter by Pengesyor (dynamic chips)
2. Search box for company name/CIDB/pengesyor
3. LazyColumn of items showing: company name, CIDB, grade, status chip, pengesyor
4. Click item to go to Keputusan SPI

Tab 3 - Keputusan SPI:
1. Back button to return to inbox
2. Application summary
3. Editable fields: Tarikh Lawatan, Date Submit SPTB, Syor SPI dropdown (SOKONG/TIDAK DISOKONG), Ulasan SPI textarea
4. Submit button with confirmation

Tab 4 - Sejarah SPI:
1. Search box
2. LazyColumn of past SPI decisions with status chips
3. Filter options

Navigation between tabs using bottom tabs or nested NavHost.

Package: com.kuskop.sptb.feature.pka

---

## Prompt 9: Inbox & Notifications

Generate the Inbox screen in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ).

Requirements:
1. Top bar with Inbox icon, title, notification count badge
2. Batch action toolbar (visible when items selected): Select All checkbox, selected count, Mark Read button, Delete Selected button
3. Search box for filtering by company name or message content
4. LazyColumn of notification cards, each showing:
   - Icon based on type (success/error/info/warning)
   - Title, message preview (truncated)
   - Timestamp (relative: 2 minit lalu, 1 jam lalu, Semalam, etc.)
   - Read/unread indicator (bold vs normal, colored dot)
   - Swipe-to-delete with SwipeToDismiss
   - Long-press to select for batch action
5. Empty state illustration when no notifications
6. Pull-to-refresh
7. Notifications stored in Room, synced with FCM
8. Click notification -> navigate to relevant screen via deep link
9. FCM service: handle data payload, create NotificationChannel, show notification with deep link intent

Package: com.kuskop.sptb.feature.inbox

---

## Prompt 10: Tapisan Excel & Bakul

Generate the Excel Screening and Bakul (Basket) screens in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ).

Requirements:

Excel Screening screen:
1. File picker for .xlsx/.xls files
2. Parse Excel using Apache POI or similar library
3. District filter: checkboxes for each district found in data, Select All button
4. Results table: checkbox column, Syarikat, CIDB, Daerah, Gred, Tarikh Excel, Update Type, Status Semasa
5. Select All checkbox in header
6. Row count display
7. Simpan Ke Bakul button -> opens modal to select application type (BARU/PEMBAHARUAN/UBAH MAKLUMAT/UBAH GRED) -> saves selected rows to Firestore Bakul collection

Bakul screen:
1. Header with item count badge
2. Table: Syarikat, Gred & CIDB, Daerah, Jenis Asal Excel, Tarikh, Delete button per row
3. Items loaded from Firestore real-time listener
4. Empty state

Firebase Firestore structure:
- /bakul/{docId}: { syarikat, cidb, gred, daerah, jenis, tarikh, userId }

Package: com.kuskop.sptb.feature.excel

---

## Prompt 11: Sejarah (History)

Generate the History screen in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ).

Requirements:
1. Status filter buttons: SEMUA STATUS, LULUS, TOLAK/SIASAT with count badges
2. Type filter buttons: SEMUA JENIS, BARU, PEMBAHARUAN, UBAH MAKLUMAT, UBAH GRED
3. Pelulus dropdown filter
4. Month and Year dropdown filters
5. Search box for company name/CIDB
6. LazyColumn of history cards showing: company name, CIDB, grade, application type, keputusan (colored chip), pelulus name, date
7. Pull-to-refresh
8. Pagination support

Package: com.kuskop.sptb.feature.history

---

## Prompt 12: Settings & Profile Screen

Generate the Settings and User Profile screens in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ).

Requirements:

Settings screen:
1. User profile card at top: name, email, role, avatar
2. Appearance section: Dark Mode toggle, Dynamic Colors toggle, Theme color picker
3. Notifications section: toggle for each notification type (Permohonan, Keputusan, Peringatan, WhatsApp)
4. Audio section: SFX Volume slider
5. Storage section: Cache size display, Clear Cache button
6. Account section: Logout button with confirmation dialog
7. About section: App version, changelog link, credits

Profile screen (from Input DB link):
1. Read-only display of user profile: Nama, Email, Role, Telefon
2. Tandatangan (Signature) image display
3. Cop (Stamp) image display
4. Firebase Code display
5. Edit button (admin only)

Package: com.kuskop.sptb.feature.settings

---

## Prompt 13: File Manager (Google Drive)

Generate a File Manager screen in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ) that integrates with Google Drive API v3.

Requirements:
1. Header showing current folder path and info
2. Upload button (multiple files), Refresh button
3. Grid/list toggle view for files
4. File cards showing: file thumbnail (icon based on type), filename, file size, last modified date
5. Click file -> open with appropriate app using Intent
6. Long-press file -> show context menu: Download, Rename, Delete, Share
7. Upload progress overlay with progress bar and percentage
8. Drag-and-drop upload area overlay when dragging files into app
9. Loading skeleton while fetching files
10. Empty state when folder has no files
11. Google Drive OAuth 2.0 integration via GoogleSignIn
12. Files listed from Drive API, cached locally

Package: com.kuskop.sptb.feature.drive

---

## Prompt 14: Navigation Host (Main App)

Generate the main navigation graph and MainActivity in Kotlin Jetpack Compose for Sistem Bersepadu SPTB (HQ) that ties all screens together.

Requirements:
1. MainActivity with setContent using Material 3 theme (dynamic colors, dark mode support)
2. NavHost with all routes defined:
   - /splash -> SplashScreen
   - /auth -> AuthScreen (Google Sign-In)
   - /biometric -> BiometricScreen
   - /main -> MainScaffold (with BottomNavigation)
3. BottomNavigation with 5 tabs:
   - Dashboard (icon: bar-chart)
   - Senarai (icon: list)
   - Borang (icon: form) - quick access to form checker
   - Inbox (icon: inbox, with badge count)
   - Lagi (icon: more-horiz) -> opens menu drawer or grid
4. Drawer menu items:
   - Admin Dashboard (visible if role=ADMIN)
   - PKA Dashboard (visible if role=PKA)
   - Tapisan Excel
   - Bakul
   - Sejarah
   - Settings
   - Logout
5. Deep link handling for FCM notifications
6. Role-based navigation (hiding tabs based on user role)
7. Scaffold with TopAppBar, BottomBar, DrawerState

Package: com.kuskop.sptb
