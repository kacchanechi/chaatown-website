# Baca Ini: Rekap Perombakan Website ChaaTown

> Tanggal: 15 November 2026.

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

## Kondisi sekarang

| Hal | Status |
|---|---|
| Lokasi proyek | `C:\projects\chaatown.website-main` (hanya di komputer ini) |
| Website live (chaatown.my.id) | **Masih versi lama** (5 Oktober 2026). Belum ada yang di-upload. |
| Aset terkunci | **Aman.** Semua dicek setelah setiap perubahan. |
| Backup | v0 (mentah) dan v1 (hasil rombak Fase 1–8) di `C:\xampp\backups\` |
| Fase 9 & 10 | Sudah selesai dan tersimpan sebagai titik simpan, **tetapi belum masuk ke backup zip v1** |

### Yang masih menunggu keputusan
1. **Owner**: menjawab 7 pertanyaan Fase 6 (isi konten Season 2).
2. **Kacchan**: kapan dan bagaimana website di-upload (deploy). Petunjuknya ada di catatan backup v1.
3. **Kacchan/owner**: apakah `www.chaatown.my.id` mau diperbaiki dan apakah `http` mau dipaksa pindah ke `https`. Keduanya diatur di Cloudflare.

---

## Tugas mandiri untuk Kacchan

Supaya Kacchan bisa merawat daftar channel Discord **sendiri** tanpa menunggu Assit, Kacchan coba jalankan skrip sinkron dalam **mode coba-coba**. Mode ini **hanya membaca dan tidak mengubah apa pun**, jadi aman.

1. Kacchan membuka **VS Code**, lalu membuka terminal dengan menekan **Ctrl + `** (tombol di bawah Esc).
2. Kacchan mengetik perintah ini lalu menekan Enter, untuk masuk ke folder proyek:
   ```
   cd C:\projects\chaatown.website-main
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


Best Regard

Assist - Build by Kacchan
