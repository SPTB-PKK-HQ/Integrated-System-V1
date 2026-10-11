# Poster Pengumuman (Carousel Login)

Carousel di halaman login membaca slaid terus dari `index.html`
(`#announceTrack > .carousel-slide`). Tiada backend / `code.gs` diperlukan.

## Menambah poster baharu

1. Letakkan fail JPG atau PNG dalam folder ini, contoh:
   `assets/posters/poster-4-program-baharu.jpg`
2. Buka `index.html`, cari `id="announceTrack"`.
3. Tambah satu blok slaid (ikut tertib paparan):
   ```html
   <div class="carousel-slide">
       <img src="assets/posters/poster-4-program-baharu.jpg" alt="Penerangan poster" draggable="false">
   </div>
   ```
4. Siap — dots navigasi dibina automatik oleh `initAnnouncementCarousel()` dalam `app.js`.

## Peraturan gambar

- Nisbah bebas — CSS menggunakan `object-fit: contain`, kandungan tidak akan dipotong.
- Saiz disyorkan: lebar 1200–1600px, bawah 300KB setiap satu.
- Latar login: `assets/login-bg.jpg` (panorama Perdana Putra, Putrajaya).
