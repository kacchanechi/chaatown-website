# Baca Ini: Rekap Perombakan Website ChaaTown

> Dimulai: 15 November 2026. Diperbarui: 19 November 2026 (Babak 6 sampai 9: galeri baru).

---

## Siapa saja yang terlibat

- **Kacchan**: moderator ChaaTown, pemegang proyek website ini, yang memberi semua keputusan dan izin.
- **Assit**: asisten yang dimintai saran oleh Kacchan dan mengerjakan perubahan setelah Kacchan setuju.
- **Owner**: pemilik server. Owner memegang keputusan soal isi konten (lihat bagian "Fase 6").

## Kamus kecil (biar nggak bingung)

| Istilah | Artinya gampangnya |
|---|---|
| **HTML / CSS / JavaScript** | HTML = isi halaman (teks, gambar). CSS = dandanan (warna, ukuran, posisi). JavaScript = gerakan dan tombol yang bisa diklik. |
| **Live Server** | Fitur di VS Code untuk membuka website di komputer sendiri (`http://127.0.0.1:5500`) sebelum di-upload ke internet. |
| **Deploy** | Meng-upload website supaya versi barunya muncul di internet (chaatown.my.id). |
| **Commit (git)** | "Save point" atau titik simpan. Kalau ada yang rusak, proyek bisa dikembalikan ke titik simpan sebelumnya. |
| **Backup .zip** | Salinan seluruh proyek yang dibungkus jadi satu file. |
| **Aset terkunci** | Data penting yang **tidak boleh berubah sama sekali**: IP server, port, link Discord, link Saweria, sosial media, harga rank, dan Paw Coin. |
| **Bot Discord** | "Akun robot" di Discord. Di proyek ini, bot hanya dipakai untuk **membaca** daftar channel. |
| **Push (git)** | Mengirim titik simpan ke GitHub sebagai cadangan online. Push **tidak** mengubah website live. |
| **Dapur galeri** | Program kecil di server (Cloudflare Worker) yang mengurus login, upload, suka, komentar, dan moderasi. Kodenya ada di folder `_api`. |
| **Cloudflare Workers / R2 / D1** | Layanan Cloudflare: Workers = tempat dapur galeri jalan, R2 = gudang foto, D1 = database kecil. |
| **Migrasi** | File berisi perintah "bangun/ubah tabel database" (`_api/migrations`). Dijalankan sekali, berurutan. |
| **Login Discord (OAuth)** | Pengunjung masuk pakai akun Discord-nya. Website hanya diberi tahu nama, avatar, dan apakah dia member server ChaaTown. |
| **Webhook** | "Kotak pos" di satu channel Discord. Dipakai dapur galeri untuk mengirim pemberitahuan ke channel mod. |
| **Turnstile** | Pemeriksa anti-bot dari Cloudflare, biasanya tanpa perlu klik apa pun. |
| **Rahasia / `.dev.vars`** | File berisi kunci rahasia (Client Secret Discord, webhook). **Tidak pernah** ikut git dan tidak boleh ditempel ke chat. |

---

## Babak 1: Kacchan minta proyeknya dicek

Kacchan membuka percakapan dengan meminta Assit **mengecek proyek website ChaaTown satu per satu**, mencari apa saja yang perlu diperbaiki.

Kacchan lalu menegaskan aturan pertama: **Assit tidak boleh langsung mengeksekusi apa pun.** Kacchan hanya mau saran dulu, dan eksekusi baru boleh jalan kalau semuanya sudah fix. Kacchan juga memberi tahu bahwa ada file yang sudah diganti, jadi Assit mengecek ulang.

Kacchan kemudian mengajukan 4 pertanyaan:

1. **"Apakah ini disebut native?"** Assit menjelaskan bahwa website ini dibuat dengan HTML, CSS, dan JavaScript murni, tanpa framework (tanpa alat bantu besar seperti React). Istilah umumnya *vanilla* atau *native web*.
2. **"Bukannya CSS dan JS biasanya punya file sendiri?"** Assit membenarkan. Waktu itu, semua CSS, JS, bahkan gambar masih dijejalkan ke dalam satu file HTML, sampai ratusan KB. Inilah yang nanti dibereskan.
3. **"Kenapa di alamat web masih ada `.html`?"** Assit menjelaskan bahwa hal itu bisa dirapikan supaya alamatnya jadi bersih, misalnya `chaatown.my.id/discord/`.
4. **"Domain ini jalan lewat Cloudflare Tunnel, jadi aset penting jangan diubah."** Assit mencatat semua aset terkunci. Assit juga mencatat bahwa semua fungsi Minecraft (beli rank, Paw Coin, format pesan beli, cek nickname) tidak boleh berubah.

## Babak 2: Persiapan sebelum bongkar-bongkar

- **Kacchan meminta backup dulu.** Assit membuat file zip **v0 (file mentah pertama)** beserta catatan, disimpan di `C:\backups\`.
- **Kacchan meminta daftar rombakan dari awal sampai akhir.** Assit menyusunnya menjadi beberapa fase.
- **Assit menemukan fakta soal hosting.** Kacchan mengira website live jalan lewat Cloudflare Tunnel. Setelah Assit mengecek, ternyata **chaatown.my.id di-hosting di GitHub Pages, dengan Cloudflare sebagai "perantara" di depannya.** Assit juga menemukan dua hal kecil:
  - `www.chaatown.my.id` tidak bisa dibuka.
  - Alamat `http://` tidak otomatis pindah ke `https://`.
- **Kacchan memberi tahu bahwa XAMPP (Apache) di PC ini sedang menjalankan proyek lain** (private) lewat tunnel. Kacchan dan Assit sepakat **XAMPP tidak boleh diutak-atik**: tidak boleh diubah setelannya dan tidak boleh di-restart.
- **Kacchan memutuskan proyek dipindah keluar dari folder XAMPP**, dan tesnya cukup pakai Live Server. Assit memindahkan proyek ke `C:\projects\chaatown.website-main`, lalu Kacchan meminta folder lama di htdocs dihapus.
- **Kacchan memutuskan proyek tidak dihubungkan ke GitHub.** Semuanya hanya ada di komputer ini. Keputusan upload ada di tangan Kacchan nanti.
- **Assit membuat alat "satpam aset"** (`_tools/cek-aset.ps1`). Alat ini mengecek bahwa IP, port, link Discord/Saweria, sosmed, harga rank, Paw Coin, format pesan beli, dan foto galeri **tidak berubah**. Assit menjalankan alat ini setiap kali selesai mengubah sesuatu.

---

## Babak 3: Perombakan besar, fase demi fase

Kacchan memberi aba-aba "lanjut Fase N" satu per satu. Assit mengerjakan **satu fase, satu titik simpan (commit)**, lalu menunggu aba-aba berikutnya. Setiap fase selalu dicek dengan alat uji otomatis, supaya tampilan dan fungsi yang tidak dimaksud **tidak ikut berubah**.

### Fase 0: Titik awal
Assit menyimpan kondisi awal proyek sebagai titik simpan pertama (**v0**), lengkap dengan alat satpam aset.

### Fase 1: Gambar dikeluarkan dari HTML
- Gambar-gambar yang tadinya "ditempel" sebagai teks panjang di dalam HTML, Assit pindahkan menjadi file gambar biasa di folder `assets/img`.
- Assit mengecilkan ukuran maskot dari 136 KB menjadi 21 KB tanpa mengurangi resolusinya.
- Hasilnya, **file halaman utama turun dari 481 KB menjadi 92 KB.**
- Kacchan sempat bertanya cara membuka Live Server, dan Assit memandu sampai website terbuka di Live Server.

### Fase 2: CSS dipisah ke file sendiri
- Assit memisahkan semua "dandanan" (CSS) ke folder `assets/css`, satu file per halaman plus file bersama.
- Assit membuang kode dandanan yang sudah tidak terpakai.
- Assit menambahkan **cadangan warna untuk browser lama** dan **meringankan efek blur di HP** supaya HP tidak berat.
- Tampilan dicek dan hasilnya **identik** dengan sebelumnya.

### Fase 3: JavaScript dipisah ke file sendiri
- Assit memisahkan semua JavaScript ke folder `assets/js`. **Data rank dan Paw Coin dikumpulkan di satu file** (`config.js`) supaya gampang dijaga.
- Assit memperbaiki bug kecil: notifikasi "IP tersalin" dulu hilang terlalu cepat kalau tombol diklik berkali-kali.
- Assit menguji 35 langkah perilaku (tab, tombol salin, galeri, dan lainnya). **Semuanya sama seperti sebelumnya**, kecuali bug yang memang diperbaiki.

### Fase 4: Alamat web jadi bersih
- Assit menawarkan dua cara, dan **Kacchan memilih cara B: struktur folder.** Dengan cara ini, alamatnya jadi `chaatown.my.id/discord/`, `/about/`, `/galeri/`, tanpa `.html`.
- Supaya link lama yang sudah dibagikan orang (misalnya `discord.html`) tidak mati, Assit memasang **halaman pengalih** yang otomatis membawa pengunjung ke alamat baru.

### Fase 5: Tampil cantik saat dibagikan
- Kacchan menyetujui saran Assit. Assit lalu menambahkan **gambar preview** (muncul saat link dibagikan di Discord atau WhatsApp), **ikon tab browser (favicon)**, dan info untuk Google (sitemap dan robots.txt).
- Assit memperbaiki ikon tab yang sebelumnya error (404).

### Fase 6: Konten Season 2, DIHENTIKAN
- Fase ini berisi perubahan **isi** website, misalnya galeri di menu, rank di guide toko peti, `/kit novice`, guide villager/crafting/realm, nama realm, mekanik nikah, dan caption foto.
- **Kacchan memutuskan Fase 6 dihentikan dan diserahkan ke owner**, karena isi konten adalah keputusan owner.
- Assit membuatkan **daftar 7 pertanyaan untuk owner**, dan Kacchan sudah memegang daftarnya.
- Assit **tidak akan menyentuh Fase 6** sampai owner menjawab.

### Fase 7: Ramah untuk semua orang (aksesibilitas)
- Assit mengaudit website dengan alat pengecek aksesibilitas. Awalnya ada **59 temuan, dan Assit membereskannya sampai 0.**
- Assit sedikit menggelapkan warna teks abu-abu di mode terang supaya lebih mudah dibaca.
- Assit menambahkan beberapa perbaikan lain:
  - Tab di halaman utama sekarang punya alamat sendiri. Contohnya, `chaatown.my.id/#guide` langsung membuka tab Guide, jadi bisa dibagikan.
  - Galeri foto lebih nyaman dipakai dengan keyboard.

### Fase 8: Ukur hasil dan backup v1
- Assit mengukur hasil akhirnya: **halaman utama yang dulu dimuat 470 KB sekarang hanya 138 KB** (sekitar 3,5 kali lebih ringan).
- Assit membuat **backup v1** (`chaatown-website_v1-rombak_2026-11-15.zip`) lengkap dengan catatan dan **daftar langkah deploy** ke GitHub Pages + Cloudflare.

---

## Babak 4: Fase 9, daftar channel Discord ikut server asli

**Kacchan punya ide:** daftar channel di halaman Discord seharusnya mengikuti channel yang **benar-benar ada** di server Discord, karena server sudah dirombak dan ada channel baru.

Kacchan memberi beberapa syarat:
- Pencocokan pakai **ID channel**.
- Deskripsi channel yang sudah ada **tetap seperti semula**.
- Yang tampil hanya channel yang **bisa dilihat member biasa**. Channel bergembok khusus admin tidak ikut.
- Nama channel ditulis rapi sesuai tema website: pakai spasi, bukan tanda strip (`-`), tanpa emoji dan hiasan.
- Kategori **Forums dibiarkan apa adanya** sampai owner memutuskan.
- Nama channel **bisa diklik**.
- Pakainya **bot**.

Yang kemudian terjadi:
- **Kacchan membuat bot sendiri** di Discord Developer Portal, mengundangnya ke server **tanpa izin apa pun**, dan menyimpan "kunci" bot (token) di komputer, di luar folder proyek. Kacchan sempat gagal menyimpan token karena Ctrl+V tidak jalan di terminal, lalu berhasil lewat Notepad.
- **Assit membuat skrip** `_tools/sync-discord.js`. Skrip ini punya dua mode:
  - **mode cek**: hanya membaca.
  - **mode sinkron**: menulis daftar channel ke halaman.
- **Assit menemukan hal menarik saat mengecek:** channel **meme** dan **owo** ternyata **tidak bisa dilihat member biasa**. Kacchan tidak melihat gembok di channel itu karena role Kacchan punya izin admin. Gembok di **Live NOW!** juga ternyata berasal dari izin "Connect" yang ditolak.
- Kacchan mengambil tiga keputusan:
  - **Izin Discord tidak diubah.** Kalau memang begitu aturannya, meme dan owo tidak ditampilkan di web.
  - **Voice Room tetap satu baris** "Voice Room", karena channel di dalamnya buatan bot TempVoice.
  - **Link channel memakai pilihan A**: nama channel membuka channel-nya langsung, ditambah kalimat petunjuk "Belum gabung? Masuk lewat undangan dulu" untuk orang baru.
- Hasilnya, ada kategori baru **Server Gate** (Rules, IP Server, About Server, Entrance) dan **Rank List** di Information. Semua nama channel bisa diklik.

## Babak 5: Fase 10, tombol tema terang/gelap

- **Kacchan bertanya** kenapa tidak ada tombol untuk ganti tema. Assit menjelaskan bahwa selama ini website mengikuti setelan HP/laptop pengunjung, dan menawarkan tombolnya.
- **Kacchan memilih A**: tombol dua posisi, terang ↔ gelap. Pilihan pengunjung diingat oleh browser, di semua halaman.
- Assit membuat tombol ikon **bulan/matahari bergaya piksel** di ujung menu, di keempat halaman.
- **Kacchan merasa pergantiannya terlalu "flat"** dan minta ada efek. Assit menawarkan dua gaya, dan **Kacchan memilih B: lingkaran yang menyebar dari tombol**. Tema baru "tumpah" dari ikon sampai memenuhi layar dalam 0,5 detik.
  - Pengunjung yang menyalakan "kurangi animasi" di perangkatnya langsung berganti tanpa efek.
  - Browser lama juga tetap bisa berganti tema, hanya tanpa efek.
  - Selama efek 0,5 detik itu, klik mouse diabaikan oleh browser. Ini bawaan browser, bukan bug.

---

## Babak 6 (19 November): Kacchan kembali, cek ulang, dan git disambung lagi

**Kacchan kembali** dan meminta Assit mengecek semua file, karena banyak yang berubah sejak rekap ini terakhir ditulis.

- **Folder proyek pindah** ke `C:\projects\chaatown-website-main` (pakai tanda strip). Folder lama `chaatown.website-main` (pakai titik) dan `chaatown-cadangan` dibiarkan sebagai cadangan.
- **Assit menemukan perubahan konten tanggal 18 November** yang dikerjakan di luar sesi:
  - Tab Top Up berisi daftar **Rank VIP** lengkap (Member gratis sampai Legend) dan form beli rank aktif lagi.
  - Sub-tab baru **Claim Block** (masih "Segera hadir") dan guide **Fishing** (Fish Rework).
  - Nama realm jadi **Frostbound** dan **Emberbound**; syarat rank toko peti diganti kalimat "sedang disesuaikan".
  - Halaman **galeri dihapus**, dan **Request Rank dihapus** dari daftar rank. Satpam aset ikut disesuaikan. Kacchan memastikan ini disengaja.
  - Jadi **sebagian isi Fase 6 sudah dikerjakan**. Sisanya tetap menunggu owner.
- **Soal GitHub, ada fakta yang perlu diluruskan.** Babak 2 mencatat "proyek tidak dihubungkan ke GitHub". Ternyata folder lama sudah tersambung ke repo **`kacchanechi/chaatown-website`** (repo **publik**, sudah ada tag `v1-rombak`). Repo ini **bukan** sumber website live: chaatown.my.id masih diambil dari repo lain (kemungkinan milik owner), jadi push ke repo ini aman.
- **Kacchan menyambung git sendiri**, dipandu Assit langkah demi langkah: `git init`, sambung ke GitHub, ambil riwayat lama, lalu commit perubahan 18 November.
- **Catatan Windows:** PowerShell memblokir perintah `npm`. Solusinya cukup ketik **`npm.cmd`** (tanpa mengubah setelan Windows).

## Babak 7: Rencana galeri baru dengan upload

**Kacchan ingin galeri kembali, dan kali ini pemain bisa upload sendiri**, "seamless seperti sosial media", hanya gambar, dengan keamanan ketat.

Assit menjelaskan bahwa GitHub Pages hanya bisa **menyajikan** file, tidak bisa **menerima** upload. Jadi galeri butuh "dapur" di Cloudflare (Workers + R2 + D1), yang muat di paket gratis. **XAMPP dan tunnel di PC ini tidak disentuh sama sekali**: tunnel hanya meneruskan ke `localhost:80`, sedangkan dapur galeri dites di port lain (8787).

Keputusan Kacchan:

| Pertanyaan | Keputusan |
|---|---|
| Siapa yang boleh upload? | **Member server Discord ChaaTown** (login Discord) |
| Langsung tayang atau dicek dulu? | **Dicek mod dulu** (antrean) |
| Fitur sosial | **Caption + nick, suka, komentar, profil pemain** |
| Komentar | **Langsung tayang**, dengan filter kata kasar, batas kecepatan, dan tombol Laporkan |
| Moderasi | **Pilihan A**: halaman mod di website + pemberitahuan lewat webhook. Bot lama tetap tanpa izin apa pun |
| 12 foto galeri lama | **Dipakai lagi** sebagai isi awal |
| Akun Cloudflare | **Belum tahu dipegang siapa**, perlu ditanyakan ke owner |

Rencananya dipecah jadi fase G1 sampai G6. Seperti biasa: **satu fase, satu commit**, dan Kacchan sendiri yang melakukan commit.

## Babak 8: Fase G1 sampai G5 (semua dikerjakan dan diuji di komputer ini)

### G1: Halaman galeri baru
- Halaman `/galeri/` dengan **feed foto, profil per pemain** (alamat `?pemain=Nama`, bisa dibagikan), dan **lightbox** (tombol panah, Esc, geser di HP).
- 12 foto lama kembali, **pengalih `galeri.html` aktif lagi** supaya link lama tidak mati, dan satpam aset kembali mengecek 12 foto beserta pemiliknya.
- Atas permintaan Kacchan, link **Galeri** ditambahkan ke menu semua halaman.

### G2: Dapur galeri (login Discord, upload, antrean)
- Kacchan menyiapkan login Discord di Developer Portal (Client ID, Client Secret, alamat redirect) dan menyimpannya di `_api/.dev.vars`. **Login Discord berhasil.**
- Browser mengecilkan foto dan mengubahnya ke WebP/JPG. Dapur **membongkar ulang isi file**: metadata (lokasi GPS, info kamera), data tempelan, dan file palsu (SVG, HTML, PNG berkedok) dibuang atau ditolak.
- Batas: 5 MB per foto, 5 upload per 24 jam, maks 10 foto menunggu. Ada pemeriksa anti-bot (Turnstile).
- Foto yang belum disetujui **hanya bisa dilihat pemiliknya** (dan mod).

### G3: Moderasi
- Halaman **`/galeri/mod/`**, khusus akun dengan role mod (`1352265845291749407`). Sesi mod hanya 12 jam.
- Mod bisa **Setujui, Tolak, Turunkan, Blokir**, dan melihat **Riwayat** semua tindakan mod. Foto yang ditolak langsung dihapus filenya.
- **Webhook ke channel mod sudah dites Kacchan dan berhasil.** Isinya hanya jumlah antrean + link, paling sering 1x per 10 menit, dan tidak bisa me-mention siapa pun.

### G4: Suka, komentar, laporan, profil
- Tombol **♥ suka** dan **💬 komentar**. Komentar maks 300 karakter, tanpa link, dengan filter kata kasar (daftarnya di `_api/src/kata.js`, boleh diubah).
- **Laporkan** foto/komentar. Komentar yang dilaporkan 3 akun otomatis disembunyikan sampai dicek mod. Halaman mod dapat tab **Laporan**.
- **Nickname punya pemilik**: akun pertama yang memakai nick jadi pemiliknya (maks 3 nick per akun), supaya tidak ada yang menyamar. Nick pemilik foto lama **dipesan**, dan mod bisa melepasnya di tab **Nickname**.

### G4b: 12 foto lama jadi post
- 12 foto lama dicatat di database (migrasi `0004_arsip.sql`) dengan pemilik khusus **"Galeri lama"** (bukan akun Discord, tidak bisa login atau diblokir), sehingga **bisa disukai dan dikomentari** juga.
- File fotonya **tidak dipindah** (tetap aset terkunci). Kalau mod menurunkan foto lama, foto hanya disembunyikan; file aslinya tetap ada.

### G5: Audit keamanan & uji serang
- Assit menyisir kode dan menutup **7 celah** (misalnya kiriman raksasa yang bisa membuat dapur kehabisan memori, nama Discord berisi karakter "pembalik teks", serbuan upload bersamaan, dan trik kata kasar dengan huruf tak terlihat atau huruf Kiril).
- Halaman galeri dan mod diberi **CSP**: browser menolak script sisipan dan kiriman data ke situs lain. Sudah dibuktikan di browser.
- Form upload diberi **pemberitahuan privasi**.
- Seluruh riwayat git diperiksa: **tidak ada rahasia yang pernah ter-commit**.
- Catatan lengkapnya ada di **`_api/KEAMANAN.md`**, termasuk **daftar cek wajib sebelum online (G6)**.

**Hasil uji terakhir: 371 uji lolos semua** (tampilan, fungsi, keamanan, aksesibilitas di mode terang/gelap/HP). Semua uji Assit dijalankan di server uji terpisah (port 8788, database sementara, notifikasi mati), jadi database dan channel mod Kacchan tidak terganggu.

## Babak 9: Profil Kacchan di halaman About

- Kacchan meminta profilnya ditambahkan sebagai **kontribusi membangun website**, hanya di halaman About (Kacchan tidak main Minecraft).
- Di bawah tombol-tombol About sekarang ada **pesan dari Kacchan** dan kartu profil: foto, **Kacchan**, **Web Developer**, dengan link ke profil Discord.
- Foto dikecilkan dari 850 KB menjadi 11,8 KB (`assets/img/tim/kacchan.webp`).
- Catatan: link profil Discord memang selalu memuat ID akun. ID itu bukan rahasia (tidak bisa dipakai login).

---

## Kondisi sekarang

| Hal | Status |
|---|---|
| Lokasi proyek | `C:\projects\chaatown-website-main` |
| Git | Tersambung ke `kacchanechi/chaatown-website` (publik). Titik simpan terakhir: profil About. Beberapa commit **belum di-push**. |
| Website live (chaatown.my.id) | **Masih versi lama** (5 Oktober 2026). Belum ada yang di-upload. |
| Galeri baru (G1 sampai G5, G4b) | **Selesai dan teruji, tetapi baru jalan di komputer ini.** Online-nya menunggu G6. |
| Aset terkunci | **Aman.** Dicek satpam aset setelah setiap perubahan (sekarang termasuk 12 foto galeri). |
| Keamanan | Audit G5 selesai. Lihat `_api/KEAMANAN.md`. |
| Backup | v0 (mentah) dan v1 (Fase 1–8) di `C:\xampp\backups\`. Zip `C:\projects\chaatown-website-main.zip` (19 Nov, sebelum galeri baru). |

### Yang masih menunggu keputusan
1. **Owner: akun Cloudflare (untuk G6).** Akun yang memegang domain chaatown.my.id milik siapa? Bisakah Kacchan diberi akses? Apakah owner setuju mendaftarkan metode pembayaran untuk R2 (pemakaiannya tetap gratis)?
2. **Kacchan: push ke GitHub** sebagai cadangan online (`git push -u origin main`).
3. **Owner**: sisa pertanyaan Fase 6 (isi konten Season 2) yang belum terjawab.
4. **Kacchan/owner**: apakah `www.chaatown.my.id` mau diperbaiki dan apakah `http` mau dipaksa pindah ke `https`. Keduanya diatur di Cloudflare.
5. **Kacchan (opsional, sebelum G6)**: menyembunyikan ID Discord pengguna dari data galeri (avatar tetap tampil).

### Fase berikutnya: G6, galeri online
Begitu akses Cloudflare ada: database & gudang foto dibuat di Cloudflare, kunci rahasia dimasukkan sebagai "secret", Turnstile memakai kunci asli, alamat login Discord ditambah alamat asli, lalu daftar cek di `_api/KEAMANAN.md` dicentang satu per satu. **Catatan DNS milik tunnel tidak akan diubah.**

---

## Tugas mandiri untuk Kacchan

### A. Merawat daftar channel Discord

Supaya Kacchan bisa merawat daftar channel Discord **sendiri** tanpa menunggu Assit, Kacchan coba jalankan skrip sinkron dalam **mode coba-coba**. Mode ini **hanya membaca dan tidak mengubah apa pun**, jadi aman.

1. Kacchan membuka **VS Code**, lalu membuka terminal dengan menekan **Ctrl + `** (tombol di bawah Esc).
2. Kacchan mengetik perintah ini lalu menekan Enter, untuk masuk ke folder proyek:
   ```
   cd C:\projects\chaatown-website-main
   ```
3. Kacchan mengetik perintah ini lalu menekan Enter:
   ```
   node _tools/sync-discord.js sinkron --coba
   ```
4. Kacchan membaca hasilnya. Kalau semuanya normal, Kacchan akan melihat:
   - pesan bahwa **meme tidak terlihat member** dan **interface sengaja disembunyikan**;
   - tulisan `--- hasil (tidak ditulis) ---`, diikuti daftar channel yang sama dengan yang tampil di website sekarang.
5. Kacchan memberi tahu Assit hasilnya: **sama**, ada tulisan **"BARU"** (artinya ada channel baru di Discord), atau muncul **error**.

Kalau suatu hari ada channel baru di Discord, Kacchan cukup menambahkan deskripsinya di file `_tools/discord-channels.json`. Setelah itu, Kacchan menjalankan perintah yang sama **tanpa** `--coba`, dan daftar di website langsung diperbarui.

### B. Menjalankan galeri di komputer sendiri

Live Server (port 5500) hanya menampilkan galeri tanpa upload. Untuk mencoba galeri lengkap (login, upload, suka, komentar, halaman mod):

1. Di terminal VS Code, masuk ke folder dapur galeri:
   ```
   cd C:\projects\chaatown-website-main\_api
   ```
2. Nyalakan dapurnya:
   ```
   npm.cmd run dev
   ```
   Kalau ditanya soal migrasi database, ketik **Y**. Tunggu sampai muncul `Ready on http://localhost:8787`.
3. Buka **http://localhost:8787/galeri/** di browser. Halaman mod ada di **http://localhost:8787/galeri/mod/**.
4. Untuk berhenti, tekan **Ctrl + C** di terminal.

### C. Menjalankan uji otomatis (sebelum perubahan besar / sebelum online)

Sambil dapur menyala, buka terminal **kedua**, masuk ke folder `_api`, lalu:
```
npm.cmd run uji
npm.cmd run serang
```
Hasil yang diharapkan: semua `PASS`, tidak ada `FAIL`. Uji ini membuat akun & foto uji di database lokal, dan bisa memicu satu pemberitahuan uji ke channel mod.

### D. Mengubah daftar kata kasar

Daftar kata yang ditolak di komentar ada di `_api/src/kata.js` (bagian `KATA`). Tambahkan atau hapus kata (huruf kecil, satu kata per isian), simpan, lalu jalankan `npm.cmd run uji` untuk memastikan tidak ada yang rusak.

### E. Aturan yang selalu berlaku

- **Jangan pernah** menempel isi `_api/.dev.vars` ke chat, Discord, atau commit. Repo GitHub-nya **publik**.
- **XAMPP, tunnel (`cloudflared`), dan folder `.cloudflared` tidak disentuh.**
- Jalankan satpam aset setelah mengubah apa pun:
  ```
  powershell -ExecutionPolicy Bypass -File _tools\cek-aset.ps1
  ```


Best Regard

Assist - Build by Kacchan
