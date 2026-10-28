# Sistem Bersepadu V1 SPTB-PKK — Dokumentasi API Sistem (`apidoc.md`)

> **Kawalan Dokumen**
>
> | Perkara | Butiran |
> |---|---|
> | Nama Sistem | Sistem Bersepadu V1 SPTB-PKK (SPTB (HQ) V6.5.2 / Enjin v610 / RAG Surat Arahan V7.9.0) |
> | Pemilik | HQ — Pusat Khidmat Kontraktor (PKK), KUSKOP |
> | Versi Dokumen | 1.2 |
> | Tarikh | 28 Oktober 2026 |
> | Skop | Semua `action` backend Web App sedia ada (GET dan POST), termasuk endpoint RAG Surat Arahan. Fokus Web sahaja. |
> | Klasifikasi | Terhad — Untuk kegunaan rasmi sahaja. Nilai rahsia disorokkan. |

---

## 1. Pengenalan API

### 1.1 Protokol Komunikasi

Sistem menggunakan **API gaya REST melalui HTTPS dengan corak RPC tindakan tunggal (Single-Endpoint RPC)**. Semua panggilan dihantar ke satu URL Web App Google Apps Script (`/exec`) dan dibezakan melalui parameter `action`.

* Kaedah HTTP: `GET` untuk bacaan, `POST` untuk tulisan dan operasi berstatus.
* Format data: `JSON` untuk permintaan dan respons. Respons sentiasa dibalut melalui `ContentService` dengan jenis MIME `application/json`.
* Pengekodan: `UTF-8`.
* Kunci konkurensi: Operasi tulis ke Google Sheet dikunci di pelayan (`LockService`, maksimum 28 saat); tindakan RAG Surat Arahan dikecualikan kerana menulis ke Firestore/Drive. Operasi baca tidak dikunci bagi prestasi.
* Mekanisme ketahanan klien: `fetchWithRetry` — bacaan dicuba semula 2 kali (lengah 3 saat + backoff), tulisan kekal 1 cubaan bagi mengelakkan penduaan rekod.

### 1.2 Format Data Am

Pembalut kejayaan am (bentuk tepat berbeza mengikut endpoint):

```json
{
  "status": "success",
  "message": "Operasi berjaya",
  "data": {}
}
```

Pembalut ralat am:

```json
{
  "status": "error",
  "message": "Keterangan ralat dalam Bahasa Melayu",
  "code": 500
}
```

Sesetengah endpoint Drive menggunakan pasangan `success: true/false` dan medan `error` (dinyatakan secara eksplisit bagi setiap endpoint di bawah).

### 1.3 Base URL Standard

> **Nota keselamatan:** URL sebenar Web App, ID Client Google, dan kunci Firebase tidak didedahkan dalam dokumen ini selaras dengan keputusan pen sorokan.

```bash
# Persekitaran Staging (Ujian / Latihan)
BASE_URL_STAGING=[URL_STAGING_KERAJAAN]/exec

# Persekitaran Production (Operasi HQ)
BASE_URL_PRODUCTION=[URL_PRODUKSI_KERAJAAN]/exec
```

Contoh panggilan baca (GET):

```bash
curl -G "[URL_PRODUKSI_KERAJAAN]/exec" \
  --data-urlencode "action=getData" \
  --data-urlencode "role=PENGESYOR" \
  --data-urlencode "userName=ALI_BIN_ABU" \
  --data-urlencode "t=1727337600000"
```

Contoh panggilan tulis (POST). **Wajib** menggunakan `text/plain` bagi mengelakkan pra-penerbangan CORS di Apps Script:

```bash
curl -X POST "[URL_PRODUKSI_KERAJAAN]/exec" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"checkAuth","email":"pengguna@[DOMAIN_KERAJAAN]"}'
```

Konvensyen dalam dokumen ini: `[URL_PRODUKSI_KERAJAAN]` merujuk kepada Base URL production di atas. Gantikan dengan nilai staging semasa ujian.

---

## 2. Keselamatan & Autentikasi

### 2.1 Model Kawalan Akses

Sistem memenuhi standard keselamatan ICT sektor awam melalui empat lapisan:

1. **Pengesahan Identiti (Google Identity Services):** Pengguna log masuk menggunakan akaun Google. Bahagian hadapan menerima `credential` (JWT ID Token), menghurai muatan untuk mendapatkan emel, dan menghantar emel tersebut ke backend untuk pengesahan. Kunci klien sebenar disorokkan sebagai `[GOOGLE_CLIENT_ID]`.
2. **Pengesahan Domain:** Backend (`getAuthenticatedUserEmail`) menormalkan emel kepada huruf kecil dan membenarkan hanya domain `@kuskop.gov.my` (dan senarai tambahan yang diluluskan). Emel luar ditolak dengan mesej `Akses tidak dibenarkan`.
3. **Pengesahan Peranan (RBAC):** Backend (`verifyUserAccess(email, allowedRoles[])`) memadankan emel kepada helaian `Users` (versi cache 10 minit) dan menyemak peranan. Perbandingan peranan dinormalkan (`KETUA SEKSYEN`, `KETUA_SEKSYEN`, huruf besar/kecil dianggap sama). Setiap handler kritikal menyenaraikan peranan yang dibenarkan.
4. **Pengesahan Firebase (Fungsi Tapisan/Bakul):** Selepas log masuk GIS berjaya, klien log masuk tanpa nama ke Firebase (`signInAnonymously`) bagi memenuhi Peraturan Firestore. Pengesyor menerima `firebaseCode` tambahan yang disimpan dalam Script Properties (`FIREBASE_CODE_MAP_<emel>`).

Matriks peranan ringkas:

| Tindakan | Peranan Dibenarkan |
|---|---|
| Baca data (`getData`, `getDashboardStats`) | Semua peranan berdaftar (tapisan tambahan mengikut `role`/`userName`) |
| Hantar syor / cipta rekod | `PENGESYOR`, `ADMIN` |
| Kemas kini rekod | `PENGESYOR`, `ADMIN`, `PELULUS` |
| Padam penuh | `ADMIN` atau `PENGESYOR` asal sahaja |
| Keputusan pelulus / SIASAT | `PELULUS`, `ADMIN` |
| PKA lawatan | `PKA` sahaja |
| Pengurusan pengguna / arkib / pembersihan | `ADMIN` sahaja |
| Cetak PDF / Drive tulis | `PENGESYOR`, `ADMIN`, `PELULUS` (butiran mengikut endpoint) |
| RAG Surat Arahan: dokumen, tanya, soalan lazim, status | `PENGESYOR`, `PELULUS`, `KETUA_SEKSYEN`, `PENGARAH`, `ADMIN` |
| RAG Surat Arahan: indeks, OCR, muat turun PDF, padam cache, ujian Firebase | `ADMIN` sahaja |

### 2.2 Header dan Token Rujukan

Tiada `Authorization: Bearer <JWT>` tersuai dihantar ke Apps Script. Rujukan keselamatan adalah seperti berikut:

**Pengepala permintaan tulis (wajib):**

```http
Content-Type: text/plain;charset=utf-8
```

**Medan identiti dalam badan POST (wajib bagi hampir semua tulis):**

```json
{
  "action": "namaTindakan",
  "email": "pengguna@[DOMAIN_KERAJAAN]"
}
```

Medan `email` bertindak sebagai prinsipal. Pelayan tidak mempercayai nama yang dihantar dalam medan `pengesyor`/`pelulus` semata-mata; ia menyemak semula profil melalui `findUserByEmailCached(email)`.

**Aliran GIS (bahagian hadapan sahaja, tidak dihantar mentah ke backend):**

```javascript
// Ringkasan logik klien (nilai sebenar disorokkan)
google.accounts.id.initialize({
  client_id: "[GOOGLE_CLIENT_ID]",
  callback: handleCredentialResponse
});
// handleCredentialResponse -> hurai JWT -> ekstrak emel -> POST {action:'checkAuth', email}
```

**Peraturan Firestore (tapisan/bakul):** Token Firebase tanpa nama diperoleh selepas `checkAuth` berjaya. Tanpa token ini, bacaan Firestore ditolak oleh peraturan pelayan.

### 2.3 Pengurusan Rahsia

Semua rahsia disimpan dalam **Script Properties** dan tidak dikomit ke repositori: `MAIN_FOLDER_ID`, `EMAIL_TO_SPI`, `EMAIL_CC_SPTB`, `YOUTUBE_API_KEY`, `FIREBASE_CODE_MAP_<emel>`, `SIASAT_QUEUE`, `PEMUTIHAN_QUEUE`, `STB_APP_DATA_VERSION`. Cache cuti umum (`PUTRAJAYA_HOLIDAYS_<tahun>`) dijana automatik oleh sistem.

RAG Surat Arahan menggunakan properti tambahan:

| Properti | Wajib | Kegunaan |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Ya | JSON akaun perkhidmatan Firestore (mentah atau base64). |
| `FIREBASE_PROJECT_ID` | Tidak | Override projek; fallback `project_id` akaun perkhidmatan, kemudian `tapisan-stb-g4-g7`. |
| `DEEPSEEK_API_KEY` | Ya untuk AI/OCR | Kunci DeepSeek, disimpan di pelayan sahaja. |
| `DEEPSEEK_MODEL` | Tidak | Model DeepSeek; lalai `deepseek-flash`. |
| `DEEPSEEK_BASE_URL` | Tidak | Endpoint penuh; lalai `https://api.deepseek.com/chat/completions`. |
| `SURAT_ARAHAN_QA_THRESHOLD` | Tidak | Ambang fuzzy cache; lalai `0.84`. |
| `SURAT_ARAHAN_DAILY_LIMIT` | Tidak | Had AI/user/hari; lalai `30`. |
| `SURAT_ARAHAN_GLOBAL_LIMIT` | Tidak | Had AI/global/hari; lalai `300`. |
| `SURAT_ARAHAN_INDEX_FOLDER_ID` | Auto | Folder khas `_SURAT_ARAHAN_INDEX`. |
| `SURAT_ARAHAN_INDEX_FILE_ID` | Auto | Fail indeks agregat terkini. |
| `SURAT_ARAHAN_INDEX_VERSION` | Auto | Versi indeks aktif. |
| `SURAT_ARAHAN_INDEX_SUMMARY` | Auto | Ringkasan dokumen/chunk semasa. |

Fail `stb-pkk-firestore-firebase-adminsdk-*.json` dikecualikan melalui `.gitignore`; jangan simpan akaun perkhidmatan atau kunci DeepSeek dalam repositori.

> **Nota keselamatan RAG:** endpoint RAG menggunakan model prinsipal `email` yang sama seperti endpoint lain (bukan pengesahan ID token). Jawapan cache boleh dibaca oleh semua peranan Surat Arahan yang dibenarkan. Laksanakan pengesahan token pelayan dan peraturan Firestore yang ketat sebelum penggunaan production penuh.

---

## 3. Dokumentasi Endpoint

> Konvensyen: `GET /exec?action=X` bermaksud `GET [URL_PRODUKSI_KERAJAAN]/exec?action=X&...`. `POST /exec` bermaksud `POST [URL_PRODUKSI_KERAJAAN]/exec` dengan badan JSON dan header `text/plain;charset=utf-8`. Contoh respons menggunakan data fiksyen.

### 3.1 Kumpulan A — Pengesahan

#### A1. `checkAuth` (GET dan POST) — Pengesahan log masuk

* **Kaedah & Path:** `GET /exec?action=checkAuth&email=<emel>` atau `POST /exec` dengan `{"action":"checkAuth","email":"..."}`
* **Deskripsi:** Mengesahkan domain dan pendaftaran pengguna. Mengembalikan profil (`name`, `email`, `role`, `color`, `phone`, `imageUrl`, `signUrl`, `copUrl`) dan `firebaseCode` bagi PENGESYOR jika wujud.
* **Kawalan akses:** Emel berdomain dibenarkan dan berdaftar dalam `Users`. Tiada semakan peranan khusus.
* **Request Headers:**

```http
Content-Type: text/plain;charset=utf-8
```

* **Request Body (POST):**

```json
{
  "action": "checkAuth",
  "email": "ali@[DOMAIN_KERAJAAN]"
}
```

* **Response Success (200 OK):**

```json
{
  "authenticated": true,
  "user": {
    "name": "ALI BIN ABU",
    "email": "ali@[DOMAIN_KERAJAAN]",
    "role": "PENGESYOR",
    "color": "#2563eb",
    "phone": "012-3456789",
    "imageUrl": "[URL_GAMBAR_PROFIL]",
    "signUrl": "[URL_TANDATANGAN]",
    "copUrl": "[URL_COP]",
    "firebaseCode": "[KOD_FIREBASE_PENGESYOR]"
  },
  "message": "Log masuk berjaya"
}
```

* **Response Error (403 Ditolak — domain atau tidak berdaftar):**

```json
{
  "authenticated": false,
  "email": "luar@example.com",
  "error": "Akses tidak dibenarkan. Hanya akaun dengan domain @[DOMAIN_KERAJAAN] dibenarkan.",
  "code": 403
}
```

```json
{
  "authenticated": false,
  "email": "baru@[DOMAIN_KERAJAAN]",
  "error": "Akaun Google anda (baru@[DOMAIN_KERAJAAN]) tidak berdaftar dalam sistem. Sila hubungi Pentadbir.",
  "code": 403
}
```

---

### 3.2 Kumpulan B — Bacaan Data Permohonan, Pengguna dan Statistik

#### B1. `getData` — Ambil permohonan (tetingkap semasa atau sejarah)

* **Kaedah & Path:** `GET /exec?action=getData&role=<ROLE>&userName=<NAMA>&v=<VERSION>&w=<WINDOW>&months=<N>&refresh=<true|1>&from=<YYYY-MM>&to=<YYYY-MM>&t=<timestamp>`
* **Deskripsi:** Endpoint bacaan utama. Lalai memulangkan tetingkap 3 bulan terkini dari sisi pelayan. Jika `v` sama dengan versi pelayan dan `w` sama dengan `windowStart`, memulangkan `cached:true`. Jika `from` dan `to` dibekalkan, mod sejarah diaktifkan (bacaan terus hamparan, tiada cache tetingkap).
* **Parameter:** `role` (cth `PENGESYOR`), `userName` (nama paparan penuh), `v` (versi klien), `w` (windowStart klien `YYYY-MM-DD`), `months` (lalai `3`), `refresh` (paksa baca hamparan), `from`/`to` (`YYYY-MM`).
* **Response Success — data baharu:**

```json
{
  "cached": false,
  "data": [
    {
      "row": 42,
      "syarikat": "SYARIKAT CONTOH SDN. BHD.",
      "cidb": "0120201118-KD061300",
      "gred": "G4",
      "jenis": "BARU",
      "pengesyor": "ALI BIN ABU",
      "syor_status": "SOKONG",
      "start_date": "2026-08-12",
      "kelulusan": "",
      "pelulus": ""
    }
  ],
  "version": "128",
  "windowStart": "2026-06-01",
  "months": 3,
  "engine": "v610"
}
```

* **Response Success — cache sah / bina semula:**

```json
{ "cached": true, "version": "128", "windowStart": "2026-06-01", "months": 3, "engine": "v610" }
```

```json
{ "cached": true, "version": "128", "windowStart": "2026-06-01", "months": 3, "rebuilding": true, "engine": "v610" }
```

> Jika `rebuilding:true`, klien hendaklah menggunakan data sedia ada dan mencuba semula selepas 5–8 saat (maksimum 3 cubaan).

* **Response Success — mod sejarah:**

```json
{
  "mode": "history",
  "from": "2025-01",
  "to": "2025-06",
  "data": [],
  "version": "128",
  "engine": "v610",
  "windowStart": "",
  "months": 0
}
```

#### B2. `getRow` — Ambil satu baris

* **Kaedah & Path:** `GET /exec?action=getRow&row=<nomborBaris>`
* **Deskripsi:** Memulangkan 32 lajur yang dipetakan kepada kunci bernama bagi satu rekod.
* **Response Success:**

```json
{
  "status": "success",
  "data": {
    "row": 42,
    "syarikat": "SYARIKAT CONTOH SDN. BHD.",
    "cidb": "0120201118-KD061300",
    "gred": "G4",
    "jenis": "BARU",
    "negeri": "SELANGOR",
    "start_date": "2026-08-12",
    "syor_lawatan": "YA",
    "date_submit": "2026-08-15",
    "pengesyor": "ALI BIN ABU",
    "syor_status": "SOKONG",
    "kelulusan": "",
    "pelulus": "",
    "borang_json": "{\"companyName\":\"SYARIKAT CONTOH SDN. BHD.\"}",
    "ulasan_spi": ""
  }
}
```

* **Response Error (400):**

```json
{ "status": "error", "message": "Row tidak sah" }
```

#### B3. `getDashboardStats` — Agregat papan pemuka

* **Kaedah & Path:** `GET /exec?action=getDashboardStats&role=<ROLE>&userName=<NAMA>`
* **Deskripsi:** Agregat ringan (<50KB) mengikut bulan/tahun: jumlah, lulus, tolak, menunggu, sokong, tidak sokong, metrik PKA, taburan jenis dan alasan, statistik pengesyor/pelulus (pandangan admin). Cache 1 jam berkunci versi data.
* **Response Success:**

```json
{
  "months": [
    {
      "month": "2026-08",
      "label": "Ogo",
      "total": 120,
      "lulus": 80,
      "tolak": 10,
      "menunggu": 30,
      "sokong": 90,
      "tidakSokong": 5,
      "jenis": { "BARU": 60, "PEMBAHARUAN": 40, "UBAH MAKLUMAT": 10, "UBAH GRED": 10 },
      "alasan": { "Dokumen tidak lengkap": 4 },
      "pkaSpi": 12,
      "pkaSelesai": 8
    }
  ],
  "years": [2026, 2025],
  "grand": { "total": 500, "lulus": 300, "tolak": 50, "menunggu": 150, "sokong": 350, "tidakSokong": 20, "pkaSpi": 40, "pkaSelesai": 30 },
  "pengesyorStats": { "ALI BIN ABU": { "total": 50, "sokong": 40, "tidak_sokong": 2 } },
  "pelulusStats": { "SITI BINTI AHMAD": { "total": 60, "lulus": 45, "tolak": 5 } }
}
```

#### B4. `refreshData` — Paksa segar semula

* **Kaedah & Path:** `GET /exec?action=refreshData&role=<ROLE>&userName=<NAMA>`
* **Deskripsi:** Membatalkan cache dan membaca semula hamparan. Bersamaaan `getData` dengan `refresh=true`.
* **Response Success:** Sama seperti B1 dengan `cached:false`.

#### B7. `getUsers` — Senarai pengguna

* **Kaedah & Path:** `GET /exec?action=getUsers&t=<timestamp>`
* **Deskripsi:** Memulangkan semua pengguna berdaftar dari helaian `Users` (nama, emel, peranan, warna, telefon, imej, tandatangan, cop).
* **Response Success:**

```json
[
  {
    "name": "ALI BIN ABU",
    "email": "ali@[DOMAIN_KERAJAAN]",
    "role": "PENGESYOR",
    "color": "#2563eb",
    "phone": "012-3456789",
    "imageUrl": "[URL_GAMBAR]",
    "signUrl": "[URL_TANDATANGAN]",
    "copUrl": "[URL_COP]"
  }
]
```

#### B8. `getUserFirebaseCode` — Kod Firebase pengguna

* **Kaedah & Path:** `GET /exec?action=getUserFirebaseCode&email=<emel>`
* **Deskripsi:** Mendapatkan kod Firebase (`FIREBASE_CODE_MAP_<emel>`) bagi fungsi tapisan/bakul. Rentetan kosong jika tiada.
* **Response Success:**

```json
{ "status": "success", "firebaseCode": "[KOD_FIREBASE]" }
```

#### B9. `getQueueData` — Barisan SIASAT dan PEMUTIHAN (am)

* **Kaedah & Path:** `GET /exec?action=getQueueData&email=<emel>&t=<timestamp>`
* **Deskripsi:** Memulangkan kedua-dua barisan dari Script Properties. Memerlukan `ADMIN`, `PENGESYOR`, `PELULUS`, `PENGARAH`, atau `KETUA_SEKSYEN`.
* **Response Success:**

```json
{ "status": "success", "siasat": [{ "syarikat": "SYARIKAT A", "row": 10 }], "pemutihan": [] }
```

* **Response Error (401):**

```json
{ "status": "error", "message": "Akses Ditolak: Role 'PKA' tidak mempunyai kebenaran untuk tindakan ini." }
```

#### B10. `getSpiQueueData` — Barisan SPI (paparan)

* **Kaedah & Path:** `GET /exec?action=getSpiQueueData&email=<emel>`
* **Deskripsi:** Data barisan SPI yang diformat untuk tab SPI. Memerlukan emel berdaftar.
* **Response Success:**

```json
{ "success": true, "siasat": [], "pemutihan": [], "kiraan": 0 }
```

#### B11. `previewSpiBacklog` — Pratonton tunggakan SPI

* **Kaedah & Path:** `GET /exec?action=previewSpiBacklog`
* **Deskripsi:** Pratonton tunggakan tanpa menghantar emel.
* **Response Success:**

```json
{ "success": true, "tunggakan": 5, "senarai": [{ "syarikat": "SYARIKAT A", "hariTertunggak": 3 }] }
```

#### B12. `sendSpiBacklogReminder` — Hantar peringatan tunggakan

* **Kaedah & Path:** `GET /exec?action=sendSpiBacklogReminder`
* **Deskripsi:** Mencetuskan penghantaran emel peringatan tunggakan SPI secara manual (biasanya tugas berjadual).
* **Response Success:**

```json
{ "success": true, "message": "Peringatan tunggakan telah dihantar." }
```

#### B13. `getLogs` (POST) — Log audit

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Membaca helaian `Logs` (terkini dahulu). Tiada semakan peranan di peringkat pelayan; kawalan paparan dikuatkuasakan di klien (sebaiknya hadkan kepada ADMIN).
* **Request Body:**

```json
{ "action": "getLogs", "email": "admin@[DOMAIN_KERAJAAN]" }
```

* **Response Success:**

```json
{
  "status": "success",
  "logs": [
    { "timestamp": "2026-09-26 10:00:00", "user": "ALI BIN ABU", "action": "INSERT_RECORD", "description": "Rekod baharu di baris 42", "folderId": "[FOLDER_ID]", "url": "[URL_FOLDER]" }
  ]
}
```

---

### 3.3 Kumpulan C — Tulis Rekod Permohonan (Insert / Update / Delete / Restore)

Semua endpoint dalam kumpulan ini menggunakan `POST /exec` dengan header `text/plain;charset=utf-8` dan medan `email` wajib. Kunci tulis pelayan dikenakan kecuali dinyatakan.

#### C1. Tambah Rekod Baharu (Insert — POST tanpa `row`)

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Menambah baris baharu ke baris kosong pertama (atau akhir). Jika `createFolder:true` dan medan syarikat/tarikh/jenis/pengesyor lengkap, folder Drive auto-dicipta. Jika syor `YA` + `date_submit` + `hantar_emel_spi:true`, dimasukkan ke `SIASAT_QUEUE`. Peranan: `PENGESYOR`, `ADMIN`.
* **Request Body:**

```json
{
  "action": "insert",
  "email": "ali@[DOMAIN_KERAJAAN]",
  "syarikat": "SYARIKAT CONTOH SDN. BHD.",
  "cidb": "0120201118-KD061300",
  "gred": "G4",
  "jenis": "BARU",
  "negeri": "SELANGOR",
  "start_date": "2026-08-12",
  "syor_lawatan": "YA",
  "date_submit": "2026-08-15",
  "justifikasi": "Lawatan tapak diperlukan",
  "pengesyor": "ALI BIN ABU",
  "syor_status": "SOKONG",
  "tarikh_syor": "2026-08-16",
  "alamat_perniagaan": "No. 1, Jalan Contoh, Shah Alam",
  "jenis_konsultansi": "Emel",
  "borang_json": "{\"companyName\":\"SYARIKAT CONTOH SDN. BHD.\"}",
  "createFolder": true,
  "hantar_emel_spi": true
}
```

> Nota: Medan `action` sebenar untuk sisipan ialah sebarang POST tanpa `row` (penghala `handleInsertNewRecord`). Nilai `"action":"insert"` di atas adalah ilustrasi; pelayan merujuk kepada ketiadaan `row`.

* **Response Success (201 Created):**

```json
{
  "status": "success",
  "action": "inserted",
  "row": 42,
  "message": "Data dimasukkan di baris 42",
  "pautan": "[URL_FOLDER_DRIVE]",
  "folderId": "[FOLDER_ID]"
}
```

* **Response Error (401/400):**

```json
{ "status": "error", "message": "Email diperlukan untuk menambah rekod." }
```

```json
{ "status": "error", "message": "Akses Ditolak: Role 'PKA' tidak mempunyai kebenaran untuk tindakan ini." }
```

#### C2. Kemas Kini Rekod (Update — POST dengan `row`)

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Mengemas kini blok lajur A–O, P–Q (SPI), R–X (lawatan/keputusan), Y–AB (pelulus), AC (`borang_json`) dan AF (`ulasan_spi`). Menguruskan queue SIASAT/PEMUTIHAN secara keadaan (state-based) dan catatan beku automatik bagi `TOLAK & BEKU`. Peranan: `PENGESYOR`, `ADMIN`, `PELULUS`.
* **Request Body (contoh keputusan pelulus):**

```json
{
  "email": "siti@[DOMAIN_KERAJAAN]",
  "row": 42,
  "kelulusan": "LULUS",
  "tarikh_lulus": "2026-09-01",
  "pelulus": "SITI BINTI AHMAD",
  "alasan": "",
  "borang_json": "{\"catatan_pelulus\":\"Disemak dan disokong.\"}"
}
```

* **Response Success (200 OK):**

```json
{ "status": "success", "action": "updated", "row": 42, "message": "Rekod berjaya dikemaskini di baris 42" }
```

* **Response Error:**

```json
{ "status": "error", "message": "Nombor baris tidak sah" }
```

#### C3. `deleteRecord` — Padam rekod atau kosongkan syor

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Dua mod: `padam_semua` (padam baris fizikal + snapshot audit + keluar queue; hanya ADMIN atau pengesyor asal) dan `padam_syor` (kosongkan lajur M–O dan Z serta status SPI).
* **Request Body (padam penuh):**

```json
{
  "action": "deleteRecord",
  "email": "admin@[DOMAIN_KERAJAAN]",
  "user": "ADMIN HQ",
  "row": 42,
  "deleteType": "padam_semua"
}
```

* **Request Body (kosongkan syor):**

```json
{
  "action": "deleteRecord",
  "email": "ali@[DOMAIN_KERAJAAN]",
  "user": "ALI BIN ABU",
  "row": 42,
  "deleteType": "padam_syor"
}
```

* **Response Success:**

```json
{ "status": "success", "message": "Rekod berjaya dipadam sepenuhnya", "action": "deleted_full" }
```

```json
{ "status": "success", "message": "Syor berjaya dikosongkan", "action": "cleared_syor" }
```

* **Response Error:**

```json
{ "status": "error", "message": "Akses Ditolak: Anda (ALI BIN ABU) bukan pengesyor asal (AHMAD BIN OMAR) untuk rekod ini." }
```

```json
{ "status": "error", "message": "Jenis padam tidak sah" }
```

#### C4. `restoreRecord` — Pulih daripada snapshot

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Memulihkan rekod yang dipadam menggunakan JSON snapshot yang disimpan semasa `DELETE_SNAPSHOT`.
* **Request Body:**

```json
{
  "action": "restoreRecord",
  "email": "admin@[DOMAIN_KERAJAAN]",
  "user": "ADMIN HQ",
  "snapshot": "{\"syarikat\":\"SYARIKAT CONTOH SDN. BHD.\",\"cidb\":\"0120201118-KD061300\", \"tindakan\":\"DIPADAM\"}"
}
```

* **Response Success:**

```json
{ "status": "success", "message": "Rekod berjaya dipulihkan di baris 43", "row": 43 }
```

* **Response Error:**

```json
{ "status": "error", "message": "Snapshot JSON tidak sah." }
```

---

### 3.4 Kumpulan D — Keputusan Pelulus dan Aliran SIASAT

#### D1. `siasatSahkan` — Pelulus sahkan ke SPI

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Mengemas kini justifikasi (L), `date_submit` (J), `borang_json` (AC), menetapkan `status_hantar_spi=DALAM QUEUE`, dan memasukkan ke `SIASAT_QUEUE` untuk penghantaran 6 petang. Peranan: `PELULUS`, `ADMIN`.
* **Request Body:**

```json
{
  "action": "siasatSahkan",
  "email": "siti@[DOMAIN_KERAJAAN]",
  "row": 42,
  "justifikasi_baru": "Disemak. Sahkan siasatan tapak.",
  "date_submit": "2026-09-26",
  "borang_json": "{\"siasat_disahkan\":true}"
}
```

* **Response Success:**

```json
{ "status": "success", "message": "Disahkan dan dimasukkan ke barisan SPI." }
```

#### D2. `siasatTolak` — Pelulus tolak ke Pengesyor + WhatsApp

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Menolak kes SIASAT kembali kepada Pengesyor dengan alasan wajib untuk makluman WhatsApp. Peranan: `PELULUS`, `ADMIN`.
* **Request Body:**

```json
{
  "action": "siasatTolak",
  "email": "siti@[DOMAIN_KERAJAAN]",
  "row": 42,
  "alasan": "Justifikasi lawatan tidak lengkap. Sila kemas kini."
}
```

* **Response Success:**

```json
{ "status": "success", "message": "Kes SIASAT ditolak ke Pengesyor." }
```

#### D3. `siasatUndo` — Batal pengesahan selagi emel belum dihantar

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Membatalkan pengesahan SIASAT selagi emel SPI belum dihantar (mengosongkan status queue). Peranan: `PELULUS`, `ADMIN`.
* **Request Body:**

```json
{ "action": "siasatUndo", "email": "siti@[DOMAIN_KERAJAAN]", "row": 42 }
```

* **Response Success:**

```json
{ "status": "success", "message": "Pengesahan SIASAT dibatalkan." }
```

* **Response Error (contoh semua D):**

```json
{ "status": "error", "message": "Row tidak sah" }
```

---

### 3.5 Kumpulan E — PKA (Lawatan SPI)

#### E1. `pkaUpdateLawatan` — Kemas kini lawatan

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Mengemas kini `lawatan_tarikh` (R), `lawatan_submit_sptb` (S), `lawatan_syor` (T), `ulasan_spi` (AF), dan `laporan_spi_url` dalam `borang_json`. Peranan: `PKA` sahaja.
* **Request Body:**

```json
{
  "action": "pkaUpdateLawatan",
  "email": "pka@[DOMAIN_KERAJAAN]",
  "row": 42,
  "lawatan_tarikh": "2026-09-20",
  "lawatan_submit_sptb": "2026-09-22",
  "lawatan_syor": "SOKONG",
  "ulasan_spi": "Lawatan selesai. Premis mematuhi syarat.",
  "laporan_spi_url": "[URL_LAPORAN_SPI]"
}
```

* **Response Success:**

```json
{ "status": "success", "message": "Lawatan berjaya dikemaskini" }
```

#### E2. `pkaGetPengesyorContact` — Nombor Pengesyor untuk WhatsApp

* **Kaedah & Path:** `POST /exec` (dikecualikan daripada kunci tulis)
* **Deskripsi:** Mencari nombor telefon Pengesyor daripada helaian `Users` dengan normalisasi nama (buang gelaran, padanan separa) dan memulangkan pautan `wa.me`. Peranan: `PKA` sahaja.
* **Request Body:**

```json
{ "action": "pkaGetPengesyorContact", "email": "pka@[DOMAIN_KERAJAAN]", "pengesyor": "ALI BIN ABU" }
```

* **Response Success:**

```json
{ "success": true, "phone": "0123456789", "waLink": "https://wa.me/60123456789" }
```

* **Response Error:**

```json
{ "success": false, "error": "Pengesyor 'X' tidak dijumpai. Nama dalam Users: ..." }
```

---

### 3.6 Kumpulan F — Google Drive dan Cetakan PDF

#### F1. `createDriveFolder` — Cipta folder syarikat

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Mencipta struktur `STB MAIN FOLDER > [Pengguna] > [Syarikat] > [Jenis Permohonan]`. Carian folder tidak peka huruf dan mengabaikan kurungan. Peranan: `PENGESYOR`, `ADMIN`.
* **Request Body:**

```json
{
  "action": "createDriveFolder",
  "email": "ali@[DOMAIN_KERAJAAN]",
  "company_name": "SYARIKAT CONTOH SDN. BHD.",
  "user_name": "ALI BIN ABU",
  "application_type": "BARU - 12-08-2026",
  "main_folder_id": "[MAIN_FOLDER_ID]"
}
```

* **Response Success:**

```json
{
  "success": true,
  "folder_url": "[URL_FOLDER_DRIVE]",
  "folder_id": "[FOLDER_ID]",
  "folder_path": "STB MAIN FOLDER > ALI BIN ABU > SYARIKAT CONTOH SDN. BHD. > BARU - 12-08-2026",
  "user_folder_url": "[URL_USER_FOLDER]",
  "message": "Folder berjaya dicipta"
}
```

* **Response Error:**

```json
{ "status": "error", "message": "Email diperlukan untuk mencipta folder." }
```

#### F2. `listDriveFiles` — Senarai fail folder

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Menyenaraikan fail dan subfolder dalam folder Drive beserta pautan lakaran kecil dan maklumat pemuat naik.
* **Request Body:**

```json
{ "action": "listDriveFiles", "email": "ali@[DOMAIN_KERAJAAN]", "folderId": "[FOLDER_ID]" }
```

* **Response Success:**

```json
{
  "success": true,
  "files": [
    {
      "id": "[FILE_ID]",
      "name": "Borang_Semakan_SYARIKAT_CONTOH.pdf",
      "mimeType": "application/pdf",
      "size": 245000,
      "lastUpdated": "2026-09-26T10:00:00.000Z",
      "webViewLink": "[URL_FAIL]",
      "thumbnailLink": "[URL_THUMBNAIL]",
      "uploadedBy": "ali@[DOMAIN_KERAJAAN]",
      "uploadedByName": "ALI BIN ABU"
    }
  ],
  "folders": [],
  "folderName": "BARU - 12-08-2026",
  "folderId": "[FOLDER_ID]",
  "parentFolderId": "[PARENT_ID]"
}
```

#### F2A. `getSuratArahanDocs` — Senarai dokumen Surat Arahan SPTB

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Menyenaraikan dokumen rujukan Surat Arahan SPTB daripada folder `STB MAIN FOLDER > SURAT ARAHAN` (termasuk subfolder sebagai kategori). Peranan: `PENGESYOR`, `PELULUS`, `KETUA_SEKSYEN`, `PENGARAH`, `ADMIN`. Baca sahaja.
* **Request Body:**

```json
{
  "action": "getSuratArahanDocs",
  "email": "ali@[DOMAIN_KERAJAAN]",
  "refresh": false
}
```

* **Response Success:**

```json
{
  "success": true,
  "folderName": "SURAT ARAHAN",
  "folderUrl": "[URL_FOLDER_DRIVE]",
  "count": 2,
  "limited": false,
  "generatedAt": "2026-10-20T10:00:00.000Z",
  "files": [
    {
      "id": "[FILE_ID]",
      "name": "Pindaan Surat Arahan Bil. 1-2026.pdf",
      "mimeType": "application/pdf",
      "size": 245000,
      "lastUpdated": "2026-10-20T09:30:00.000Z",
      "webViewLink": "[URL_FAIL]",
      "downloadUrl": "[URL_MUAT_TURUN]",
      "category": "Pindaan",
      "description": "Pindaan syarat kelayakan dan prosedur semakan dokumen berkuat kuasa 1 November 2026."
    }
  ]
}
```

* **Response Error:**

```json
{ "success": false, "error": "Folder SURAT ARAHAN belum disediakan. Sila cipta folder \"SURAT ARAHAN\" di dalam STB MAIN FOLDER dan muat naik dokumen rujukan." }
```

* **Nota Operasi:**
  * Folder ID boleh ditetapkan melalui Script Property `SURAT_ARAHAN_FOLDER_ID`; jika tiada, sistem mencari subfolder bernama `SURAT ARAHAN` di bawah `STB MAIN FOLDER`.
  * Hasil senarai di-cache selama 5 minit. `refresh: true` memintas cache.
  * Had 200 fail dan 3 aras subfolder.
  * Medan `description` diambil daripada Description fail di Google Drive. Isi Description dengan ringkasan kandungan dokumen supaya butiran dipaparkan di bawah nama fail.

#### F2B. `askSuratArahan` — Tanya chatbot RAG Surat Arahan

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Menjawab soalan pengguna berdasarkan indeks dokumen Surat Arahan. Sistem menyemak cache Firestore dahulu, kemudian melakukan carian BM25 (6 chunk teratas) dan memanggil DeepSeek. Jawapan AI yang berjaya disimpan semula ke cache secara automatik.
* **Kawalan akses:** `PENGESYOR`, `PELULUS`, `KETUA_SEKSYEN`, `PENGARAH`, `ADMIN`.
* **Request Body:**

```json
{
  "action": "askSuratArahan",
  "email": "ali@[DOMAIN_KERAJAAN]",
  "question": "Apakah dokumen yang perlu disediakan untuk permohonan STB?"
}
```

* **Response — cache hit:**

```json
{
  "success": true,
  "mode": "cache",
  "cached": true,
  "answer": "Dokumen yang perlu disediakan ialah borang permohonan, salinan SSM, dan salinan kad pengenalan [S1].",
  "sources": [
    {
      "fileId": "[FILE_ID]",
      "name": "Surat Arahan Bil. 2-2026.pdf",
      "category": "Umum",
      "page": 3,
      "chunkId": "[FILE_ID]_p3_c0",
      "score": 8.42,
      "preview": "Dokumen yang perlu disediakan untuk permohonan STB ialah...",
      "ref": "S1"
    }
  ],
  "matchedQuestion": "Apakah dokumen yang perlu disediakan untuk permohonan STB?",
  "matchScore": 0.96
}
```

* **Response — jawapan AI baharu:**

```json
{
  "success": true,
  "mode": "ai",
  "cached": false,
  "answer": "Dokumen yang perlu disediakan ialah borang permohonan, salinan SSM, dan salinan kad pengenalan [S1].",
  "sources": [
    {
      "fileId": "[FILE_ID]",
      "name": "Surat Arahan Bil. 2-2026.pdf",
      "category": "Umum",
      "page": 3,
      "chunkId": "[FILE_ID]_p3_c0",
      "score": 8.42,
      "preview": "Dokumen yang perlu disediakan untuk permohonan STB ialah...",
      "ref": "S1"
    }
  ],
  "matchedQuestion": "Apakah dokumen yang perlu disediakan untuk permohonan STB?",
  "confidence": 0.88,
  "note": "",
  "model": "deepseek-flash",
  "qaId": "q_0123456789abcdef0123456789abcdef01234567"
}
```

* **Response — tiada padanan:**

```json
{
  "success": true,
  "mode": "no_match",
  "cached": false,
  "answer": "Maaf, saya tidak menemui maklumat yang berkaitan dalam dokumen Surat Arahan yang telah diindeks. Sila cuba kata kunci lain atau rujuk dokumen penuh di tab Dokumen.",
  "sources": []
}
```

* **Response — indeks belum dibina:**

```json
{
  "success": false,
  "code": "SA_RAG_INDEX_MISSING",
  "needsIndex": true,
  "error": "Indeks dokumen Surat Arahan belum dibina. Sila hubungi Pentadbir untuk menjalankan proses indeks di tab Urus."
}
```

* **Response — had kadar:**

```json
{
  "success": false,
  "code": "SA_RAG_RATE_LIMIT",
  "error": "Had harian anda telah mencapai 30 soalan AI. Sila cuba lagi esok."
}
```

* **Nota Operasi:**
  * Soalan minimum 3 aksara dan maksimum 600 aksara selepas normalisasi ruang.
  * Cache menggunakan SHA-256 soalan ternormal, alias keys, dan fuzzy similarity (ambang lalai `0.84`). Cache yang merujuk versi dokumen lama akan diabaikan.
  * Cache hit tidak menggunakan kuota AI. Hanya panggilan AI baharu direkod dalam `surat_arahan_usage`.
  * Jawapan AI tetap dipulangkan walaupun penyimpanan cache gagal; dalam kes ini `qaId` boleh kosong.
  * Setiap permintaan adalah **single-turn** — tiada sejarah perbualan dihantar ke DeepSeek.
  * `confidence` ialah nombor 0–1 (lalai 0.6 jika model tidak memulangkan nilai), bukan label teks.

#### F2C. `listSuratArahanFaq` — Senarai soalan lazim / cache

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Menyenaraikan jawapan cache yang paling kerap digunakan. Pengguna biasa menerima maksimum 20 entri; `ADMIN` menerima maksimum 100 entri. Jawapan cache yang merujuk versi dokumen lama ditanda `stale` dan ditapis keluar untuk pengguna bukan admin.
* **Kawalan akses:** `PENGESYOR`, `PELULUS`, `KETUA_SEKSYEN`, `PENGARAH`, `ADMIN`.
* **Request Body:**

```json
{
  "action": "listSuratArahanFaq",
  "email": "ali@[DOMAIN_KERAJAAN]"
}
```

* **Response Success:**

```json
{
  "success": true,
  "isAdmin": false,
  "faqs": [
    {
      "id": "q_0123456789abcdef0123456789abcdef01234567",
      "question": "Apakah dokumen yang perlu disediakan untuk permohonan STB?",
      "answer": "Dokumen yang perlu disediakan ialah borang permohonan, salinan SSM, dan salinan kad pengenalan [S1].",
      "hitCount": 12,
      "lastUsedAt": "2026-10-28T03:00:00.000Z",
      "sources": [
        {
          "fileId": "[FILE_ID]",
          "name": "Surat Arahan Bil. 2-2026.pdf",
          "category": "Umum",
          "page": 3,
          "chunkId": "[FILE_ID]_p3_c0",
          "score": 8.42,
          "preview": "Dokumen yang perlu disediakan untuk permohonan STB ialah...",
          "ref": "S1"
        }
      ],
      "stale": false
    }
  ]
}
```

* **Nota Operasi:**
  * Jika tiada cache langsung, respons mengandungi soalan lalai dengan `isDefault: true` dan `answer` kosong.
  * Untuk `ADMIN`, medan tambahan `askedBy` dan `askedByName` disertakan; entri `stale: true` turut dipulangkan supaya admin boleh memadamnya.
  * Sumber cache disimpan bersama `ref` (`S1`, `S2`, ...) untuk dipadankan dengan sitasi dalam jawapan.

#### F2D. `deleteSuratArahanQa` — Padam jawapan cache

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Memadam satu dokumen cache `surat_arahan_qa`. Soalan yang sama akan menjana jawapan AI baharu pada masa hadapan.
* **Kawalan akses:** `ADMIN` sahaja.
* **Request Body:**

```json
{
  "action": "deleteSuratArahanQa",
  "email": "admin@[DOMAIN_KERAJAAN]",
  "id": "q_0123456789abcdef0123456789abcdef01234567"
}
```

* **Response Success:**

```json
{ "success": true, "id": "q_0123456789abcdef0123456789abcdef01234567" }
```

* **Response Error:**

```json
{ "success": false, "error": "ID jawapan tidak sah." }
```

* **Nota Operasi:** ID mesti bermula dengan `q_` diikuti 8–64 aksara heksadesimal. Padam dokumen yang tidak wujud tetap dikira berjaya.

#### F2E. `getSuratArahanStatus` — Status indeks dan kesegaran dokumen

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Memulangkan status indeks RAG, kiraan PDF semasa, dan senarai fail yang ditambah/diubah/dibuang berbanding metadata indeks. Digunakan oleh tab Urus dan lencana status dalam modal.
* **Kawalan akses:** `PENGESYOR`, `PELULUS`, `KETUA_SEKSYEN`, `PENGARAH`, `ADMIN`.
* **Request Body:**

```json
{
  "action": "getSuratArahanStatus",
  "email": "ali@[DOMAIN_KERAJAAN]"
}
```

* **Response Success:**

```json
{
  "success": true,
  "isAdmin": false,
  "firebaseConfigured": true,
  "firebaseError": "",
  "index": {
    "exists": true,
    "version": "20261028120000_a1b2c3",
    "builtAt": "2026-10-28T04:00:00.000Z",
    "documentCount": 24,
    "chunkCount": 318,
    "indexedFileCount": 24,
    "indexedFileIds": ["[FILE_ID_1]", "[FILE_ID_2]"]
  },
  "currentPdfCount": 25,
  "stale": true,
  "addedFiles": ["Surat Arahan Bil. 3-2026.pdf"],
  "changedFiles": [],
  "removedFiles": [],
  "folderUrl": "[URL_FOLDER_DRIVE]"
}
```

* **Nota Operasi:**
  * `firebaseConfigured` adalah `false` jika metadata Firestore gagal dibaca; `firebaseError` memuatkan mesej teknikal.
  * `stale` bernilai `true` jika indeks belum wujud atau terdapat fail PDF baharu/diubah/dipadam.
  * `indexedFileIds` digunakan oleh pemilih dokumen admin untuk mengenal pasti fail yang belum diindeks (baharu atau gagal); array ini kosong untuk pengguna bukan admin.
  * Senarai `addedFiles`, `changedFiles`, dan `removedFiles` dihadkan kepada 30 nama setiap satu.

#### F2F. `getSuratArahanFileData` — Muat turun PDF untuk indeks (base64)

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Memulangkan kandungan fail PDF dalam folder Surat Arahan sebagai base64 untuk diekstrak oleh PDF.js di pelayar. Hanya fail PDF dalam folder Surat Arahan diterima.
* **Kawalan akses:** `ADMIN` sahaja.
* **Request Body:**

```json
{
  "action": "getSuratArahanFileData",
  "email": "admin@[DOMAIN_KERAJAAN]",
  "fileId": "[FILE_ID]"
}
```

* **Response Success:**

```json
{
  "success": true,
  "fileId": "[FILE_ID]",
  "name": "Surat Arahan Bil. 2-2026.pdf",
  "mimeType": "application/pdf",
  "size": 245000,
  "lastUpdated": "2026-10-20T09:30:00.000Z",
  "base64": "[BASE64_PDF]"
}
```

* **Response Error:**

```json
{ "success": false, "error": "Hanya fail PDF boleh diproses untuk indeks AI." }
```

* **Nota Operasi:**
  * Had saiz fail ialah 20MB.
  * Fail mesti berada dalam folder Surat Arahan (termasuk subfolder).
  * Endpoint ini hanya untuk aliran indeks admin; paparan PDF biasa menggunakan pratonton Drive/PDF.js sedia ada.

#### F2G. `saveSuratArahanDocText` — Simpan teks halaman dokumen

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Menerima teks per halaman hasil PDF.js/OCR, memecahkannya kepada chunk, dan menyimpan fail bahagian `part_<fileId>.json` dalam folder indeks khas.
* **Kawalan akses:** `ADMIN` sahaja.
* **Request Body:**

```json
{
  "action": "saveSuratArahanDocText",
  "email": "admin@[DOMAIN_KERAJAAN]",
  "fileId": "[FILE_ID]",
  "category": "Umum",
  "pages": [
    { "page": 1, "text": "Teks penuh halaman 1...", "ocr": false },
    { "page": 2, "text": "Teks penuh halaman 2...", "ocr": true }
  ]
}
```

* **Response Success:**

```json
{
  "success": true,
  "fileId": "[FILE_ID]",
  "chunks": 6,
  "pages": 2,
  "extractedAt": "2026-10-28T04:10:00.000Z"
}
```

* **Nota Operasi:**
  * Maksimum 500 halaman; setiap halaman dipotong pada 30,000 aksara; jumlah teks maksimum 3,000,000 aksara.
  * Fail mesti PDF dan masih berada dalam folder Surat Arahan pada masa simpan.
  * Chunk menggunakan saiz ~1,100 aksara dengan ~180 aksara pertindihan.

#### F2H. `ocrSuratArahanPages` — OCR halaman imbas melalui DeepSeek

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Menghantar sehingga 3 imej halaman (data URL) kepada DeepSeek untuk transkripsi teks. Digunakan hanya apabila PDF.js tidak menemui teks yang mencukupi.
* **Kawalan akses:** `ADMIN` sahaja.
* **Request Body:**

```json
{
  "action": "ocrSuratArahanPages",
  "email": "admin@[DOMAIN_KERAJAAN]",
  "images": [
    { "page": 1, "dataUrl": "data:image/jpeg;base64,[BASE64_IMEJ]" }
  ]
}
```

* **Response Success:**

```json
{
  "success": true,
  "pages": [
    { "page": 1, "text": "Teks yang diekstrak daripada imej..." }
  ],
  "model": "deepseek-flash"
}
```

* **Response Error:**

```json
{ "success": false, "error": "Maksimum 3 imej setiap permintaan." }
```

* **Nota Operasi:**
  * Format data URL yang diterima: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`.
  * Had panjang data URL ialah 4,500,000 aksara setiap imej.
  * `DEEPSEEK_API_KEY` wajib; tanpa kunci, OCR gagal tetapi indeks teks PDF biasa masih boleh dibina.
  * Imej dihantar kepada DeepSeek — pastikan dokumen tidak mengandungi data terhad yang tidak dibenarkan keluar dari persekitaran yang diluluskan.

#### F2I. `finalizeSuratArahanIndex` — Bina dan simpan indeks BM25

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Menggabungkan fail bahagian dokumen menjadi indeks BM25 tunggal, menyimpannya sebagai `index_<versi>.json.gz` dalam folder `_SURAT_ARAHAN_INDEX`, dan mengemas kini metadata Firestore `surat_arahan_meta/current`. Sokong indeks penuh atau indeks pilihan tanpa membuang dokumen sedia ada.
* **Kawalan akses:** `ADMIN` sahaja.
* **Request Body:**

```json
{
  "action": "finalizeSuratArahanIndex",
  "email": "admin@[DOMAIN_KERAJAAN]",
  "fileIds": ["[FILE_ID_1]", "[FILE_ID_2]"],
  "merge": true
}
```

* **Response Success:**

```json
{
  "success": true,
  "version": "20261028120000_a1b2c3",
  "builtAt": "2026-10-28T04:15:00.000Z",
  "documentCount": 2,
  "chunkCount": 14,
  "indexedFileIds": ["[FILE_ID_1]", "[FILE_ID_2]"]
}
```

* **Nota Operasi:**
  * Jika `fileIds` kosong atau tiada, semua fail `part_*.json` dalam folder indeks digunakan. Frontend menghantar hanya fail yang berjaya diproses supaya dokumen yang dipadam tidak kekal dalam indeks.
  * `merge:true` mengekalkan ID fail yang sudah ada dalam `surat_arahan_meta/current.fileMap`; gunakan ini untuk **Indeks Pilihan** supaya dokumen lain tidak hilang daripada indeks. Jika fail telah dipadam dari Drive, gunakan **Bina Semula Indeks** untuk membersihkan entri lama.
  * Tanpa `merge` (atau `merge:false`), indeks dibina semula hanya daripada `fileIds` yang dihantar; ini ialah tingkah laku **Bina Semula Indeks** penuh.
  * Hanya 3 fail indeks terbaharu dikekalkan; indeks lama dipindahkan ke tong sampah selepas indeks baharu disimpan.
  * Indeks disimpan di bawah `MAIN_FOLDER_ID`, bukan di dalam folder `SURAT ARAHAN`, supaya tidak tersenarai sebagai dokumen rujukan.
  * Jika saiz indeks melebihi had cache, sistem membacanya terus dari Drive.

#### F2J. `testSuratArahanFirebase` — Ujian sambungan Firestore

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Menulis dokumen ujian `surat_arahan_meta/connection` untuk mengesahkan akaun perkhidmatan Firestore dan konfigurasi DeepSeek.
* **Kawalan akses:** `ADMIN` sahaja.
* **Request Body:**

```json
{
  "action": "testSuratArahanFirebase",
  "email": "admin@[DOMAIN_KERAJAAN]"
}
```

* **Response Success:**

```json
{
  "success": true,
  "test": {
    "projectId": "[PROJEK_FIRESTORE]",
    "deepseekConfigured": true,
    "deepseekModel": "deepseek-flash",
    "metaExists": true,
    "testedAt": "2026-10-28T04:20:00.000Z",
    "testedBy": "admin@[DOMAIN_KERAJAAN]"
  }
}
```

* **Nota Operasi:** Kejayaan endpoint ini mengesahkan kebenaran tulis Firestore, bukan kualiti jawapan atau ketersediaan model DeepSeek.

#### Nota Keseluruhan RAG Surat Arahan

* **Koleksi Firestore:** `surat_arahan_qa` (cache jawapan), `surat_arahan_meta` (metadata indeks; dokumen `current` dan `connection`), `surat_arahan_usage` (kuota harian per pengguna/global).
* **Storan indeks:** folder Drive khas `_SURAT_ARAHAN_INDEX` di bawah `MAIN_FOLDER_ID`; fail bahagian `part_<fileId>.json`; indeks agregat `index_<versi>.json.gz`.
* **Model:** DeepSeek Chat Completions (lalai `deepseek-flash`), JSON mode dengan cubaan semula tanpa `response_format` jika API menolak JSON mode.
* **Kesegaran cache:** jawapan cache yang sumbernya telah berubah atau dipadam tidak digunakan semula dan tidak dipaparkan kepada pengguna bukan admin.
* **Belum dilaksanakan:** maklum balas/rating jawapan, perbualan berbilang giliran, dan penomboran penuh senarai cache admin (had 100).
* **Keselamatan:** endpoint mempercayai `email` yang dihantar klien; pengesahan ID token Google di pelayan dan peraturan Firestore yang ketat masih menjadi prasyarat production.

#### F3. `uploadDriveFile` — Muat naik fail (base64)

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Menyahkod base64 dan mencipta fail dalam folder. Pemilik direkodkan dalam Description untuk kawalan padam. Peranan: `PENGESYOR`, `ADMIN`, `PELULUS`, `PKA`.
* **Request Body:**

```json
{
  "action": "uploadDriveFile",
  "email": "ali@[DOMAIN_KERAJAAN]",
  "folderId": "[FOLDER_ID]",
  "fileName": "surat-bank.pdf",
  "mimeType": "application/pdf",
  "fileData": "[BASE64_DATA]"
}
```

* **Response Success:**

```json
{
  "success": true,
  "file": {
    "id": "[FILE_ID]",
    "name": "surat-bank.pdf",
    "mimeType": "application/pdf",
    "size": 120000,
    "lastUpdated": "2026-09-26T10:05:00.000Z",
    "webViewLink": "[URL_FAIL]",
    "uploadedBy": "ali@[DOMAIN_KERAJAAN]"
  }
}
```

#### F4. `deleteDriveFile` — Padam fail

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Memindahkan fail ke tong sampah. Hanya pemuat naik asal atau ADMIN dibenarkan (fail lama tanpa pemilik dikecualikan). Peranan: `PENGESYOR`, `ADMIN`, `PELULUS`, `PKA` (tertakluk pemilik).
* **Request Body:**

```json
{ "action": "deleteDriveFile", "email": "ali@[DOMAIN_KERAJAAN]", "fileId": "[FILE_ID]" }
```

* **Response Success:**

```json
{ "success": true, "message": "Fail \"surat-bank.pdf\" berjaya dipadam." }
```

* **Response Error:**

```json
{ "success": false, "error": "Hanya pemuat naik asal fail ini atau ADMIN boleh memadamnya." }
```

#### F5. `renameDriveFile` — Namakan semula fail

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Menamakan semula fail Drive. Peranan: `PENGESYOR`, `ADMIN`, `PELULUS`.
* **Request Body:**

```json
{ "action": "renameDriveFile", "email": "ali@[DOMAIN_KERAJAAN]", "fileId": "[FILE_ID]", "newName": "surat-bank-kemaskini.pdf" }
```

* **Response Success:**

```json
{ "success": true, "file": { "id": "[FILE_ID]", "name": "surat-bank-kemaskini.pdf" } }
```

#### F6. `cetak_dan_simpan_pdf` — Jana dan simpan PDF borang

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Menerima HTML borang, menanam imej sebagai base64, menukar kepada PDF, dan menyimpan dalam folder syarikat (guna folder sedia ada jika `existing_folder_url` dibekalkan). Peranan: `PENGESYOR`, `ADMIN`, `PELULUS`.
* **Request Body:**

```json
{
  "action": "cetak_dan_simpan_pdf",
  "email": "ali@[DOMAIN_KERAJAAN]",
  "htmlContent": "<div>Borang Semakan ...</div>",
  "company_name": "SYARIKAT CONTOH SDN. BHD.",
  "user_name": "ALI BIN ABU",
  "user_color": "#2563eb",
  "application_type": "BARU - 12-08-2026",
  "custom_file_name": "Borang_Semakan_SYARIKAT_CONTOH",
  "existing_folder_url": "[URL_FOLDER_SEDIA_ADA]"
}
```

* **Response Success:**

```json
{
  "success": true,
  "folder_url": "[URL_FOLDER]",
  "folder_id": "[FOLDER_ID]",
  "file_url": "[URL_PDF]",
  "file_id": "[FILE_ID]",
  "file_name": "Borang_Semakan_SYARIKAT_CONTOH.pdf",
  "folder_path": "STB MAIN FOLDER > ALI BIN ABU > SYARIKAT CONTOH SDN. BHD. > BARU - 12-08-2026",
  "message": "PDF berjaya disimpan dengan imej tertanam dan folder disiapkan"
}
```

---

### 3.7 Kumpulan G — Carian dan Utiliti

#### G1. `searchYoutube` — Carian video rujukan

* **Kaedah & Path:** `POST /exec` (dikecualikan kunci)
* **Deskripsi:** Mencari 12 video YouTube berdasarkan kata kunci menggunakan kunci pelayan.
* **Request Body:**

```json
{ "action": "searchYoutube", "query": "panduan CIDB G4" }
```

* **Response Success:**

```json
{
  "success": true,
  "data": [{ "id": { "videoId": "[VIDEO_ID]" }, "snippet": { "title": "Panduan ...", "channelTitle": "..." } }]
}
```

---

### 3.8 Kumpulan H — Pentadbiran Pengguna dan Penyelenggaraan

Semua endpoint kumpulan ini memerlukan peranan `ADMIN`. Medan `email` ialah emel pentadbir; emel sasaran menggunakan medan khusus (`newUserEmail`, `targetEmail`, `userEmail`).

#### H1. `addUser` — Tambah pengguna

* **Kaedah & Path:** `POST /exec`
* **Request Body:**

```json
{
  "action": "addUser",
  "email": "admin@[DOMAIN_KERAJAAN]",
  "newUserEmail": "baru@[DOMAIN_KERAJAAN]",
  "userEmail": "baru@[DOMAIN_KERAJAAN]",
  "name": "AHMAD BIN OMAR",
  "role": "PENGESYOR",
  "color": "#16a34a",
  "phone": "019-1234567",
  "imageUrl": "[URL_GAMBAR]",
  "signUrl": "[URL_TANDATANGAN]",
  "copUrl": "[URL_COP]",
  "firebaseCode": "[KOD_FIREBASE]"
}
```

* **Response Success:**

```json
{ "status": "success", "message": "Pengguna berjaya ditambah" }
```

* **Response Error:**

```json
{ "status": "error", "message": "Email sudah berdaftar: baru@[DOMAIN_KERAJAAN]" }
```

#### H2. `updateUser` — Kemas kini pengguna

* **Kaedah & Path:** `POST /exec`
* **Request Body:**

```json
{
  "action": "updateUser",
  "email": "admin@[DOMAIN_KERAJAAN]",
  "targetEmail": "baru@[DOMAIN_KERAJAAN]",
  "name": "AHMAD BIN OMAR",
  "role": "PELULUS",
  "color": "#9333ea",
  "phone": "019-7654321"
}
```

* **Response Success:**

```json
{ "status": "success", "message": "Pengguna berjaya dikemaskini" }
```

#### H3. `deleteUser` — Padam pengguna

* **Kaedah & Path:** `POST /exec`
* **Request Body:**

```json
{ "action": "deleteUser", "email": "admin@[DOMAIN_KERAJAAN]", "targetEmail": "baru@[DOMAIN_KERAJAAN]" }
```

* **Response Success:**

```json
{ "status": "success", "message": "Pengguna berjaya dipadam" }
```

#### H4. `archiveYearSheet` — Arkib helaian tahunan

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Mengarkibkan data tahun semasa ke helaian arkib bagi pengurusan volum.
* **Request Body:**

```json
{ "action": "archiveYearSheet", "email": "admin@[DOMAIN_KERAJAAN]", "year": "2025" }
```

* **Response Success:**

```json
{ "status": "success", "message": "Helaian tahun 2025 berjaya diarkibkan" }
```

#### H5. `cleanupFirebaseCodes` — Pembersihan kod Firebase

* **Kaedah & Path:** `POST /exec`
* **Deskripsi:** Membersihkan entri `FIREBASE_CODE_MAP_*` yang yatim (pengguna dipadam atau peranan berubah).
* **Request Body:**

```json
{ "action": "cleanupFirebaseCodes", "email": "admin@[DOMAIN_KERAJAAN]" }
```

* **Response Success:**

```json
{ "status": "success", "message": "Pembersihan kod Firebase selesai. 2 entri dibuang." }
```

---

## 4. Pengendalian Ralat (Error Handling)

### 4.1 Jadual Kod Ralat Standard Sistem

| Kod HTTP / Logik | Status Logik | Maksud | Tindakan Klien Disyorkan |
|---|---|---|---|
| `200 OK` | `success`, `authenticated:true`, `cached:true/false` | Permintaan berjaya. Termasuk kes cache sah dan `rebuilding:true`. | Papar data. Jika `rebuilding:true`, jadualkan semula selepas 5–8 saat. |
| `201 Created` | `action:inserted` | Rekod baharu diwujudkan. | Segarkan senarai, navigasi ke baris baharu. |
| `400 Bad Request` | `status:error` | Parameter tidak sah: `Row tidak sah`, `Jenis padam tidak sah`, `folderId/fileId diperlukan`, `Teks PDF kosong`, `Snapshot JSON tidak sah`. | Betulkan input, jangan cuba semula automatik. Contoh: semak `row >= 2`. |
| `401/403 Unauthorized/Forbidden` | `authenticated:false` atau `status:error` dengan `Akses Ditolak` | Domain tidak dibenarkan, pengguna tidak berdaftar, atau peranan tidak layak. Mesej membezakan punca (emel tiada, domain salah, bukan pengesyor asal, hanya pemuat naik/ADMIN). | Kekal di skrin log masuk atau papar mesej kebenaran. Tunjuk semula butang Google. |
| `404 Not Found (logik)` | `success:false` | Folder/fail Drive tiada atau tiada kebenaran; helaian tiada. Mesej mesra: `Folder Drive tidak dapat diakses...`. | Minta pengguna semak pautan atau hubungi pentadbir. |
| `500 Server Error` | `status:error`, `success:false` | Ralat dalaman: pengecualian GAS, kegagalan API luaran, kegagalan Drive. Mesej mengandungi `error.toString()`. | Log ke konsol, papar modal ralat, benarkan cubaan manual. |
| `503 Service Unavailable` | `status:error`, `code:503` | Had masa kunci (`timeout/timed out`) — pelayan sibuk memproses tulis lain. | Tunggu dan cuba semula dengan backoff (baca sahaja). Jangan duplikasi tulis. |
| `200 OK` | `success:false`, `code:SA_RAG_INDEX_MISSING` | Indeks RAG belum dibina. | Papar mesej kepada pengguna; admin perlu jalankan indeks di tab Urus. |
| `200 OK` | `success:false`, `code:SA_RAG_RATE_LIMIT` | Kuota AI per pengguna atau global telah habis. | Papar mesej had; cuba esok. Cache hit masih dibenarkan. |
| `200 OK` | `success:false`, `code` bermula `SA_RAG_` | Ralat konfigurasi Firestore/DeepSeek, OCR kosong, atau ralat dalaman RAG. | Log kod dan mesej; semak Script Properties, indeks, dan kuota API. |
| `200 OK` | `success:false`, `code:SA_RAG_FIRESTORE_AUTH` | Akaun perkhidmatan Firestore gagal mendapatkan token. | Semak `FIREBASE_SERVICE_ACCOUNT_JSON`, private key, dan kebenaran projek. |
| `200 OK` | `success:false`, `code:SA_RAG_DEEPSEEK_CONFIG` | `DEEPSEEK_API_KEY` tiada. | Tetapkan kunci dalam Script Properties; OCR/AI tidak boleh berjalan tanpanya. |

### 4.2 Contoh Respons Ralat Standard

**400 — Input tidak sah:**

```json
{ "status": "error", "message": "Baris tidak sah" }
```

**401 — Tanpa emel pengesahan:**

```json
{ "status": "error", "message": "Email diperlukan untuk menambah rekod." }
```

```json
{ "status": "error", "message": "Akses Ditolak: Pengesahan emel diperlukan untuk padam rekod." }
```

**403 — Peranan tidak layak:**

```json
{ "status": "error", "message": "Akses Ditolak: Role 'PKA' tidak mempunyai kebenaran untuk tindakan ini." }
```

**500 — Ralat dalaman:**

```json
{ "status": "error", "message": "Exception: Cannot call SpreadsheetApp.getActiveSpreadsheet() ..." }
```

**503 — Pelayan sibuk (timeout kunci):**

```json
{
  "status": "error",
  "code": 503,
  "message": "Server sibuk memproses data lain, sila cuba sebentar lagi."
}
```

**RAG — indeks belum dibina:**

```json
{
  "success": false,
  "code": "SA_RAG_INDEX_MISSING",
  "needsIndex": true,
  "error": "Indeks dokumen Surat Arahan belum dibina. Sila hubungi Pentadbir untuk menjalankan proses indeks di tab Urus."
}
```

**RAG — konfigurasi DeepSeek tiada:**

```json
{
  "success": false,
  "code": "SA_RAG_DEEPSEEK_CONFIG",
  "error": "DeepSeek API key belum ditetapkan. Sila tetapkan DEEPSEEK_API_KEY dalam Script Properties."
}
```

### 4.3 Amalan Terbaik Pengendalian di Klien

1. **Bezakan baca dan tulis:** Baca (`GET`) selamat dicuba semula; tulis (`POST` sisipan/kemas kini) tidak boleh dicuba semula secara automatik bagi mengelakkan penduaan.
2. **Hormati `rebuilding:true`:** Gunakan data cache sedia ada, tetapkan pemasa tunggal 5–8 saat, had 3 cubaan.
3. **Paparan dwibahasa ralat:** Mesej pelayan dalam Bahasa Melayu dipaparkan terus dalam modal; ralat teknikal (`error.toString()`) direkodkan ke konsol dan helaian `Logs`.
4. **Jejak audit:** Semua tulis yang berjaya dan gagal merekodkan `logActivity` dengan pengguna, tindakan, dan ID folder berkaitan untuk semakan forensik.
5. **Kiraan hari bekerja:** Deadline SPI ialah 14 hari bekerja (Isnin–Jumaat) tidak termasuk cuti umum Putrajaya. Senarai cuti dimuatkan dan dicache automatik oleh backend (`PUTRAJAYA_HOLIDAYS_<tahun>`, refresh 30 hari) daripada kalendar awam Google "Holidays in Malaysia" — utama ICS dengan cubaan semula, sandaran `CalendarApp`, dan override manual `PUTRAJAYA_HOLIDAYS_MANUAL`; hujung minggu dan cuti umum tidak dikira dan penghantaran emel queue hanya berlaku pada hari bekerja.
6. **RAG Surat Arahan:** Hormati `needsIndex:true` dengan memaparkan arahan kepada admin. Jangan ulang `askSuratArahan` secara automatik apabila menerima `SA_RAG_RATE_LIMIT` atau ralat konfigurasi. Untuk reindex penuh, hadkan `saveSuratArahanDocText` kepada fail yang berjaya diproses dan hantar `fileIds` semasa `finalizeSuratArahanIndex`. Untuk **Indeks Pilihan**, hantar hanya ID yang dipilih bersama `merge:true` supaya dokumen lain kekal dalam indeks; pemilih admin menggunakan `indexedFileIds` daripada `getSuratArahanStatus` untuk mengenal pasti fail belum diindeks/gagal.

---

## Lampiran — Senarai Semak Integrasi Pantas

```bash
# 1. Kesihatan baca
curl -G "[URL_PRODUKSI_KERAJAAN]/exec" --data-urlencode "action=getDashboardStats" --data-urlencode "role=ADMIN"

# 2. Pengesahan
curl -X POST "[URL_PRODUKSI_KERAJAAN]/exec" -H "Content-Type: text/plain;charset=utf-8" -d '{"action":"checkAuth","email":"admin@[DOMAIN_KERAJAAN]"}'

# 3. Senarai pengguna
curl -G "[URL_PRODUKSI_KERAJAAN]/exec" --data-urlencode "action=getUsers" --data-urlencode "t=$(date +%s)000"

# 4. Status indeks RAG Surat Arahan
curl -X POST "[URL_PRODUKSI_KERAJAAN]/exec" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"getSuratArahanStatus","email":"admin@[DOMAIN_KERAJAAN]"}'

# 5. Tanya chatbot RAG Surat Arahan
curl -X POST "[URL_PRODUKSI_KERAJAAN]/exec" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"askSuratArahan","email":"ali@[DOMAIN_KERAJAAN]","question":"Apakah dokumen yang perlu disediakan untuk permohonan STB?"}'

# 6. Ujian sambungan Firestore (admin)
curl -X POST "[URL_PRODUKSI_KERAJAAN]/exec" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"testSuratArahanFirebase","email":"admin@[DOMAIN_KERAJAAN]"}'
```

*— Tamat `apidoc.md` —*
