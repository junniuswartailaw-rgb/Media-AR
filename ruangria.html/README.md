# RuangRia: AR Bangun Ruang (versi dengan materi Tampak Bangun)

> Bagian ini menjelaskan **materi baru "Melihat Bangun dari Berbagai Arah"**. Penjelasan AR lintas perangkat dari versi sebelumnya ada di bagian **"RuangRia: AR Bangun Ruang (versi perbaikan AR lintas perangkat)"** di bawah dan masih berlaku.

## Materi baru: Tampak Bangun (depan, atas, samping kanan)

Dibuka dari banner biru **"Bangun yang sama, tampak berbeda?"** di Beranda dan di halaman Materi. Alurnya mengikuti `Storyboard_kubus_balok.pdf` (halaman Canva 23 sampai 27):

| Layar | Isi | Acuan storyboard |
|---|---|---|
| Mengenal Bangun dari Kubus | Bangun X dan Y dari kubus satuan, jumlah kubus, petunjuk "bangun yang sama bisa terlihat berbeda" | tambahan (Bagian A) |
| Melihat dari Berbagai Arah | Bangun X + tombol DEPAN, ATAS, SAMPING KANAN | hal. 23 |
| Tampak Depan | tinggi kolom kiri, tengah, kanan = 2, 3, 1 | hal. 24 |
| Tampak Atas | 3 persegi berjajar | hal. 25 |
| Tampak Samping Kanan | 3 persegi bertumpuk + pertanyaan "Mengapa tampak depan dan samping bisa berbeda?" (jawaban bisa dibuka) | hal. 26 |
| Latihan | "Mana Tampak Depan Bangun Y?" (tinggi 1, 1, 2, 1; pilihan A, B, C persis storyboard, C benar), lalu 5 soal serupa | hal. 27 |
| Hasil | skor, bintang, rekor, tombol ulangi | tambahan |

Tombol KEMBALI, MENU, LATIHAN, dan tombol arah berfungsi sesuai tautan di storyboard (KEMBALI dari tampak ke hal. 23, KEMBALI dari latihan ke halaman tampak terakhir, MENU ke halaman Materi).

### Ketepatan visualisasi
Gambar tidak ditempel. Setiap bangun disimpan sebagai tabel tinggi kolom di `tampak.js` (`SHAPES`), dan semuanya dihitung dari tabel itu: gambar isometrik, proyeksi depan, atas, samping kanan, pilihan jawaban latihan, model 3D, dan model AR. Aturan arah: depan = tinggi terbesar tiap kolom dari kiri ke kanan; atas = persegi bagi tiap kolom yang terisi (baris belakang di atas); samping kanan = tinggi terbesar tiap baris, bagian depan bangun di sisi kiri gambar. Menambah bangun atau soal baru cukup menambah satu baris tabel di `SHAPES` dan `QUESTIONS`.

### Latihan
6 soal (3 tampak depan, 2 tampak atas, 1 tampak samping kanan). Pengecoh dihitung dari bangunnya (terbalik kiri-kanan, terbalik depan-belakang, tampak yang lain, salah hitung satu kubus). Jawaban salah memberi petunjuk sesuai jenis kesalahan, kesalahan kedua menambah petunjuk yang lebih jelas, dan siswa boleh mencoba lagi. Poin: benar percobaan 1 = 2, percobaan 2 = 1, selebihnya 0; skor akhir = poin / 12 x 100. Hasil akhir juga tercatat di halaman **Nilai** aplikasi (sebagai satu permainan), dan rekor tersendiri disimpan di `localStorage` kunci `ruangria-tampak-v1`.

### 3D dan AR
- **Putar 3D**: viewer interaktif (geser = putar, cubit atau gulir = ukuran). Tombol Depan, Atas, Samping kanan memutar model tepat ke arah itu dan menampilkan gambar proyeksi 2D di pojok untuk dibandingkan. Dipakai juga sebagai alternatif bila AR tidak didukung.
- **Lihat dalam AR**: memakai sistem AR yang sudah ada (WebXR bila ada, mode kamera bila tidak). Di mode kamera ada tombol baru **Depan, Atas, Samping kanan** yang menghadapkan sisi itu ke kamera, jadi siswa bisa mencocokkan pengalaman AR dengan latihan.
- Bila WebGL tidak ada: pesan jelas dan gambar isometrik statis. Bila kamera ditolak, tidak ada, atau halaman bukan HTTPS: pesan jelas dan siswa kembali ke materi.

## Daftar file yang diubah atau ditambah

| File | Perubahan |
|---|---|
| `tampak.js` (baru) | seluruh materi: data bangun, proyeksi, gambar SVG, layar, latihan, viewer 3D, model untuk AR |
| `tampak.css` (baru) | gaya materi (kelas berawalan `tb-`, tidak bentrok dengan gaya lama) |
| `script.js` | tambahan kecil: `window.RuangRiaThree` (menyerahkan kelas Three.js bawaan), komponen `TampakHost`, halaman `tampak` di router, label topbar, dua banner, cabang `tampak:` di `pS` (pembuat model) dan `views` di `B3`. Materi, jaring-jaring, kuis, musik, nilai, dan AR lama tidak diubah |
| `ar-camera.js`, `ar-camera.css` | tombol arah pandang, aktif hanya jika pemanggil memberi `T.views` (bangun lama tidak terpengaruh) |
| `index.html` | memuat `tampak.css` dan `tampak.js` |
| `service-worker.js` | cache `v5`, `tampak.js` dan `tampak.css` ikut di-cache |
| `README.md` | bagian ini |

`script.js` adalah hasil build (tanpa folder `src/` di ZIP), jadi perubahan dibuat sebagai penggantian teks yang tepat sasaran. Jika Anda punya `src/` asli, pindahkan `TampakHost` dan patch kecil itu ke sana.

## Menjalankan

```sh
cd folder-ruangria
python3 -m http.server 8000
```

Buka `http://localhost:8000` di laptop (jangan `file://`). Untuk HP, kamera hanya berjalan di HTTPS: unggah ke Netlify, Cloudflare Pages, atau GitHub Pages (lihat bagian bawah), atau pakai terowongan HTTPS sementara. Setelah mengubah file, naikkan `CACHE_NAME` di `service-worker.js`.

## Panduan menguji di perangkat sungguhan

1. Buka tautan HTTPS, pilih banner **Bangun yang sama, tampak berbeda?**, telusuri semua layar, kerjakan latihan.
2. Di layar Tampak Depan ketuk **Putar 3D**, lalu Depan, Atas, Samping kanan. Gambar di pojok harus sama bentuknya dengan model.
3. Ketuk **Lihat dalam AR**. Android dengan ARCore: ketuk lantai untuk meletakkan bangun (jalur WebXR asli, belum ada tombol arah pandang). Perangkat lain: izinkan kamera (dan gerakan di iPhone), lalu coba tombol Depan, Atas, Samping kanan.
4. Tolak izin kamera: pesan harus muncul dan tombol **Kembali ke model 3D** berfungsi.
5. Putar layar HP saat materi dan viewer terbuka.

## Hasil pengujian otomatis (Chromium dengan Playwright, bukan perangkat asli)

Dijalankan di Chromium 141 dengan WebGL software dan kamera palsu: 36 uji logika (proyeksi dan soal, termasuk kesamaan soal 1 dengan storyboard), 27 uji alur navigasi, 18 uji latihan (petunjuk, skor, masuk ke Nilai), 25 uji kecocokan render 3D dengan proyeksi 2D (7 bangun x 3 arah, piksel), 21 uji AR dan galat, 135 uji responsif (HP 360 dan 390 lebar, HP lanskap, tablet, laptop: tanpa luapan, tombol tidak bertumpuk, tombol minimal 44 px, dialog 3D muat), serta uji fitur lama (Materi, viewer 3D, AR kubus, Bermain, Petunjuk, Nilai). Tidak ada error console.

## Keterbatasan yang ditemukan

- **Belum diuji di HP, tablet, iPhone, atau Safari asli.** Emulasi hanya mengubah ukuran layar. Sensor gerak, dialog izin Safari, performa di HP menengah, dan sentuhan nyata belum diverifikasi. Jangan menyatakan AR berjalan di semua perangkat.
- **Jalur WebXR (Android ARCore) tidak bisa diuji** di sini. Model bangun tampak ikut memakai jalur itu lewat `pS`, tetapi tombol arah pandang dan gestur putar hanya ada di mode kamera, tidak di overlay WebXR asli.
- Mode kamera tidak mendeteksi permukaan (lihat keterbatasan versi sebelumnya).
- Uji kecocokan AR memakai kamera dengan giroskop tidak aktif (seperti laptop). Perilaku tombol arah pandang saat HP digerakkan (giroskop aktif) secara logika sama (rotasi relatif terhadap kamera), tetapi belum diamati di perangkat nyata.
- Proyeksi samping hanya samping **kanan** sesuai storyboard.
- Bangun di materi hanya susunan kubus satuan. Bentuk balok dan bangun ruang lain tetap ada di materi lama.
- Pengecualian aksesibilitas yang sengaja diubah dari storyboard: teks tombol MENU berwarna gelap (putih di atas kuning tidak terbaca jelas) dan warna hijau dan oranye sedikit digelapkan agar kontras cukup.

---

# RuangRia: AR Bangun Ruang (versi perbaikan AR lintas perangkat)

Aplikasi HTML5 statis. `script.js` dan `style.css` adalah hasil build (React, Three.js, font, ilustrasi sudah di dalamnya). Folder `src/` proyek asli tidak ada di ZIP, jadi perbaikan AR dibuat sebagai modul terpisah yang mudah dibaca: `ar-camera.js` dan `ar-camera.css`.

## Cara kerja AR sekarang (dua jalur otomatis)

| Jalur | Dipakai saat | Kemampuan |
|---|---|---|
| WebXR `immersive-ar` (kode asli, tidak diubah) | Android Chrome dengan ARCore | Deteksi permukaan lantai atau meja, ketuk untuk meletakkan bangun |
| Mode kamera (baru, `ar-camera.js`) | Semua perangkat lain: iPhone, iPad, Android tanpa ARCore, tablet, laptop dan PC dengan webcam | Kamera sebagai latar, bangun 3D di atasnya, sensor gerak membuat bangun "terkunci" di ruang, geser untuk memutar, cubit atau gulir untuk ukuran, dua jari untuk memindahkan |

Mode kamera TIDAK mendeteksi permukaan. Bangun muncul di arah pandang kamera saat AR dibuka atau saat tombol **Atur ulang** ditekan. Tanpa sensor gerak (misalnya laptop), bangun menempel di layar dan dikendalikan dengan geser dan gulir.
Jika kamera tidak ada atau ditolak, muncul pesan jelas dan pengguna kembali ke viewer 3D biasa.

Untuk menguji mode kamera di HP yang punya WebXR, buka alamat dengan tambahan `?ar=camera`, misalnya `https://situsmu.example/?ar=camera`.

## Penyebab masalah yang ditemukan

1. **AR hanya memakai WebXR `immersive-ar`, tanpa cadangan.** Fungsi `B3` di `script.js` langsung menolak jika `navigator.xr` tidak ada atau tidak mendukung `immersive-ar`. Safari di iPhone dan iPad tidak menyediakan WebXR AR, begitu juga banyak Android tanpa ARCore dan semua desktop. Hasilnya tombol "Lihat dalam AR" hanya memunculkan modal "AR belum didukung" dan kamera tidak pernah dibuka. Ini sudah direproduksi pada versi asli.
2. **Tidak ada `getUserMedia`**, sehingga tidak ada jalur kamera biasa.
3. **File ikon PNG tidak ada** (`icon-192.png`, `icon-512.png`) padahal dirujuk `index.html` dan `manifest.json`, sehingga ikon PWA dan ikon layar utama iPhone gagal dimuat (404).
4. **Meta viewport belum mendukung layar berponi** (`viewport-fit=cover`).
5. **Teks modal galat** hanya menyebut WebXR dan tidak memberi petunjuk izin kamera atau alternatif.

## Daftar perubahan

| File | Perubahan |
|---|---|
| `ar-camera.js` (baru) | Mode kamera: `getUserMedia`, Three.js bawaan aplikasi, sensor gerak, gestur, ganti kamera depan atau belakang, penanganan galat dan pembersihan sumber daya |
| `ar-camera.css` (baru) | Gaya overlay AR, mengikuti warna dan huruf overlay asli, aman untuk poni dan landscape, tombol minimal 44 px |
| `script.js` | `B3` asli diganti nama `B3xr` dan tidak diubah. `B3` baru memilih WebXR bila tersedia, jika tidak atau gagal beralih ke mode kamera. Teks modal diperbarui. Selebihnya (materi, jaring-jaring, kuis, musik, nilai) tidak disentuh |
| `index.html` | Memuat modul baru, `viewport-fit=cover`, ikon iOS `icon-180.png`, meta PWA tambahan |
| `manifest.json` | Ikon PNG lengkap termasuk ikon maskable terpisah, `id`, `lang` |
| `service-worker.js` | Cache naik ke `v4`, aset baru ikut di-cache (AR kamera tetap bisa dibuka offline setelah kunjungan pertama) |
| `icons/` | Ditambah `icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` dari desain asli |
| `_headers`, `.nojekyll` (baru) | Konfigurasi Netlify, Cloudflare Pages, dan GitHub Pages |

## Menjalankan di komputer sendiri

```sh
cd folder-ruangria
python3 -m http.server 8000
```

Buka `http://localhost:8000` di komputer. Jangan buka `index.html` langsung (`file://`), kamera dan service worker akan diblokir.

**Penting untuk uji di HP:** alamat jaringan lokal seperti `http://192.168.1.5:8000` BUKAN konteks aman, jadi browser HP memblokir kamera. Pilih salah satu:
- Unggah ke hosting HTTPS (cara termudah, lihat bawah).
- Terowongan HTTPS sementara, misalnya `npx localtunnel --port 8000` atau `cloudflared tunnel --url http://localhost:8000`, lalu buka tautan `https://` yang diberikan di HP.
- Android Chrome lewat kabel USB: buka `chrome://inspect/#devices` di komputer, aktifkan port forwarding 8000, lalu buka `http://localhost:8000` di HP.

## Mengunggah ke hosting HTTPS

Semua layanan ini gratis dan otomatis HTTPS. Unggah isi folder ini (bukan ZIP-nya).
- **Netlify:** masuk ke app.netlify.com/drop lalu seret folder.
- **Cloudflare Pages:** Upload assets, pilih folder.
- **GitHub Pages:** unggah ke repositori, Settings, Pages, pilih branch `main` dan folder root. `.nojekyll` sudah disediakan.

Setelah mengubah file, naikkan angka `CACHE_NAME` di `service-worker.js` (misalnya `v5`) agar pengguna lama menerima versi baru.

## Panduan pengujian

Lakukan di tautan HTTPS, bukan `file://`.

**Android (Chrome)**
1. Buka tautan, masuk Materi, pilih bangun, ketuk **Lihat dalam AR**.
2. Jika HP mendukung ARCore: layar AR asli muncul, arahkan ke lantai atau meja, ketuk saat lingkaran putih muncul.
3. Jika tidak: Chrome meminta izin kamera, ketuk Izinkan, bangun muncul di atas kamera. Gerakkan HP, bangun tetap di tempatnya.
4. Uji geser, cubit, **Atur ulang**, **Ganti kamera**, **Tutup AR**.
5. Uji tolak izin: pesan galat harus muncul dan tombol "Kembali ke model 3D" berfungsi.

**iPhone dan iPad (Safari)**
1. Ketuk **Lihat dalam AR**. Safari menampilkan dua dialog: izin gerakan dan orientasi (ketuk Izinkan), lalu izin kamera (ketuk Izinkan).
2. Jika salah menolak: ikon "aA" di bilah alamat, Pengaturan Situs, izinkan Kamera dan Gerakan, lalu muat ulang.
3. Browser lain di iOS (Chrome, Firefox) memakai mesin Safari dan umumnya berfungsi sama. Buka dari aplikasi seperti WhatsApp atau Instagram sering gagal, gunakan "Buka di Safari".
4. Opsional: Bagikan, Tambah ke Layar Utama untuk memasang sebagai PWA.

**Tablet:** sama seperti HP. Putar layar saat AR terbuka, tampilan harus menyesuaikan.

**Komputer:** buka di Chrome, Edge, Firefox, atau Safari, izinkan webcam. Geser mouse untuk memutar, roda mouse untuk ukuran. `Esc` menutup AR.

## Pengujian yang sudah dilakukan

Dijalankan di Chromium otomatis (Playwright) dengan kamera palsu dan WebGL software: emulasi Pixel 7 (portrait dan landscape), iPhone 14, iPad, dan desktop 1366x768. Yang lolos: pembukaan kamera, tampilan video dan model 3D, ketujuh bangun, geser, cubit dua jari, roda mouse, Atur ulang, Tutup AR dan pembersihan (kamera mati, overlay hilang, scroll kembali), buka tutup berulang, rotasi layar saat AR terbuka, sensor gerak (event disimulasikan), alur izin sensor iOS (disimulasikan), penolakan izin, kamera tidak ada, kamera dipakai aplikasi lain, API kamera tidak ada, HTTP tidak aman, WebXR yang gagal lalu beralih ke mode kamera, pemuatan ikon dan manifest, serta service worker dan reload offline. Tidak ada galat console.

## Keterbatasan yang masih ada

- **Belum diuji di perangkat fisik.** Tidak ada iPhone, Safari asli, atau HP Android asli di lingkungan pengujian, jadi perilaku nyata sensor gerak, kalibrasi arah, performa di HP menengah, dan dialog izin Safari belum diverifikasi. Emulasi iPhone di atas hanyalah Chromium dengan profil perangkat. Uji di perangkat sungguhan sebelum dipakai untuk sidang atau penelitian dan catat hasilnya.
- **Jalur WebXR (Android ARCore) tidak bisa diuji** di lingkungan ini. Kodenya tidak diubah dari versi asli.
- **Mode kamera bukan pelacakan permukaan.** Tidak ada pengenalan lantai atau meja dan tidak ada skala dunia nyata. Bangun bisa bergeser pelan (drift) mengikuti akurasi giroskop. Di perangkat tanpa giroskop (laptop), bangun menempel di layar.
- **Safari iOS tidak mendukung WebXR AR.** Pelacakan permukaan di iPhone hanya mungkin lewat AR Quick Look (file USDZ). Itu belum dibuat di versi ini dan butuh pengujian di iPhone asli.
- **Tidak ada pelacakan marker atau gambar** (AR.js atau MindAR) karena aplikasi asli tidak memakainya dan tidak ada marker yang diminta.
- Browser dalam aplikasi (WhatsApp, Instagram, TikTok) sering memblokir kamera. Pengguna perlu membuka di browser biasa.
- Perangkat tanpa kamera atau tanpa WebGL tetap bisa memakai viewer 3D biasa. Klaim "berjalan di perangkat apa pun" tidak bisa dijamin, yang dijamin hanya adanya pesan jelas dan alternatif.
- PWA hanya membuat aplikasi bisa dipasang dan berjalan offline. PWA tidak menambah kemampuan AR.
