# APK Android — Sistem Bersepadu SPTB (HQ)

APK ini ialah **Trusted Web Activity (TWA)** yang membuka sistem web rasmi:

```
https://sptb-pkk-hq.github.io/Integrated-System-V1/
```

Kandungan web dikemas kini secara automatik melalui GitHub Pages. APK hanya perlu
dikemas kini apabila bahagian **native** berubah (contohnya logik updater, ikon atau
permission).

## Ciri utama

- Splash screen native dengan logo SPTB.
- Semakan `version.json` dari GitHub Releases setiap kali aplikasi dibuka.
- Dialog kemas kini + changelog + saiz muat turun.
- Muat turun APK dalam aplikasi, semakan SHA-256, kemudian buka pemasang Android.
- Panduan benarkan “Install unknown apps”.
- Fallback ke halaman release jika muat turun gagal.
- Sokongan paksa kemas kini melalui `minSupportedVersionCode`.

Android **tidak membenarkan** pemasangan APK secara senyap untuk aplikasi sideload.
Pengguna tetap perlu menekan **Update/Install** pada pemasang Android.

## Struktur

```
android/
  app/
    src/main/java/my/gov/kuskop/sptb/
      SplashActivity.kt          # splash + semakan/update/install
      TwaActivity.kt             # Trusted Web Activity
      update/
        UpdateManifest.kt        # model version.json
        UpdateChecker.kt         # fetch manifest
        ApkDownloader.kt         # muat turun + SHA-256
        ApkInstaller.kt          # FileProvider + installer
        UpdateViewModel.kt       # state semakan/muat turun
    src/main/res/                # tema, layout, ikon
  tools/generate_icons.py        # jana ikon daripada icon.png
  version.properties             # versionCode / versionName
  release-notes.md               # nota release semasa
```

## URL penting

- APK terkini:
  `https://github.com/SPTB-PKK-HQ/Integrated-System-V1/releases/download/android-latest/sptb-hq-latest.apk`
- Manifest kemas kini:
  `https://github.com/SPTB-PKK-HQ/Integrated-System-V1/releases/download/android-latest/version.json`
- Halaman muat turun:
  `https://sptb-pkk-hq.github.io/Integrated-System-V1/download.html`
- Asset links:
  `https://sptb-pkk-hq.github.io/.well-known/assetlinks.json`

## Release APK baharu

1. Kemas kini `version.properties`:
   ```properties
   VERSION_CODE=2
   VERSION_NAME=1.0.1
   MIN_SUPPORTED_VERSION_CODE=1
   ```
   `VERSION_CODE` mesti sentiasa lebih besar daripada release sebelumnya.

2. Kemas kini `release-notes.md` dengan changelog pengguna.

3. Commit dan push:
   ```bash
   git add android/version.properties android/release-notes.md
   git commit -m "Android v1.0.1"
   git push origin main
   ```

4. Pilih salah satu:

   **A. Tag (disyorkan)**
   ```bash
   git tag android-v1.0.1
   git push origin android-v1.0.1
   ```

   **B. Manual GitHub Actions**
   - Buka **Actions → Android Release → Run workflow**.
   - Workflow akan membina APK, mencipta release `android-v1.0.1`, dan mengemas kini
     release `android-latest`.

Workflow akan:
- build APK bertandatangan;
- sahkan tandatangan APK;
- jana `version.json` + SHA-256;
- terbitkan release versi;
- kemas kini `android-latest` (URL stabil untuk updater).

## Signing

Keystore release **tidak** disimpan dalam repo. Ia berada di:

```
C:\Users\zfzar\Documents\SPTB-Android-Signing\release.jks
```

Fail credentials berada di folder yang sama. **Backup keystore dan password** ke
tempat selamat. Jika keystore hilang, pengguna tidak boleh memasang update dan
perlu uninstall/reinstall.

GitHub Secrets yang digunakan:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Fingerprint sertifikat release:

```
7E:BE:FB:98:E8:32:94:C2:B5:44:7B:1A:22:A7:53:FB:E5:29:A0:0A:8B:24:CC:A1:CD:0D:6B:E1:57:0C:60:89
```

Jika keystore bertukar, kemas kini `android/assetlinks/assetlinks.json` dan fail
yang sama di repo `SPTB-PKK-HQ/sptb-pkk-hq.github.io`.

## Build tempatan

Prasyarat:
- JDK 17
- Android SDK Platform 35 + Build Tools
- Tetapkan `ANDROID_HOME`

```bash
cd android
./gradlew :app:assembleDebug
```

Release build memerlukan environment variables:

```bash
export ANDROID_KEYSTORE_FILE=/path/to/release.jks
export ANDROID_KEYSTORE_PASSWORD=...
export ANDROID_KEY_ALIAS=sptb
export ANDROID_KEY_PASSWORD=...
./gradlew :app:assembleRelease
```

APK debug menggunakan application ID `my.gov.kuskop.sptb.debug` dan tidak menyemak
kemas kini. Untuk ujian updater, guna APK release.

## Ujian update

1. Pasang APK v1.0.0.
2. Terbitkan v1.0.1 (versionCode 2).
3. Buka aplikasi v1.0.0.
4. Dialog “Kemas Kini Tersedia” sepatutnya muncul.
5. Tekan **Kemas Kini Sekarang** → muat turun → pemasang Android → **Update**.
6. Semak versi di **Settings → Apps → SPTB HQ**.

## Nota keselamatan

- Hanya APK dari repo GitHub rasmi diterima (`UpdateManifest` menyemak prefix URL).
- SHA-256 disemak sebelum pemasang dibuka.
- Android juga mengesahkan tandatangan APK semasa update; APK dengan tandatangan
  berbeza akan ditolak.
- Tiada permission storage diperlukan; APK disimpan dalam cache aplikasi melalui
  FileProvider.
