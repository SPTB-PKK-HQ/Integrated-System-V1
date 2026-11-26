# Digital Asset Links untuk TWA

Fail `assetlinks.json` mesti diterbitkan di root domain:

```
https://sptb-pkk-hq.github.io/.well-known/assetlinks.json
```

Bukan di bawah `/Integrated-System-V1/`.

## Langkah

1. Cipta repo awam `SPTB-PKK-HQ/sptb-pkk-hq.github.io`.
2. Salin `assetlinks.json` ke `.well-known/assetlinks.json`.
3. Tambah fail kosong `.nojekyll` di root repo (supaya GitHub Pages tidak mengabaikan folder `.well-known`).
4. Aktifkan GitHub Pages untuk branch `main`, folder `/ (root)`.
5. Sahkan dengan Google Digital Asset Links API:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://sptb-pkk-hq.github.io&relation=delegate_permission/common.handle_all_urls
```

## Jika keystore bertukar

Tukar nilai `sha256_cert_fingerprints` kepada fingerprint keystore baharu. Jika keystore bertukar tanpa mengemas kini fail ini, TWA akan menunjukkan address bar.
