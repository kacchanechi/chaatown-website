# Keamanan Galeri ChaaTown

> Catatan hasil audit Fase G5 (19 November 2026). Untuk Kacchan, owner, dan siapa pun yang nanti merawat galeri.

## Pengaman yang terpasang

| Bagian | Pengamannya |
|---|---|
| **Siapa yang boleh** | Hanya member server Discord ChaaTown (login Discord). Mod dikenali dari role Discord, sesi mod hanya 12 jam. Akun bisa diblokir mod. |
| **Sesi login** | Kunci acak di cookie `__Host-` (HttpOnly, Secure, SameSite=Lax). Database hanya menyimpan sidiknya (SHA-256). Token Discord langsung dicabut setelah login. |
| **Anti-CSRF** | Semua aksi yang mengubah data (POST) wajib datang dari situs sendiri (header `Origin` dicocokkan persis). |
| **File foto** | Hanya JPG/WebP (browser mengubah PNG dulu). Isi file dibongkar dan disusun ulang: metadata (GPS, info kamera), data tempelan, SVG/HTML/PNG berkedok ditolak atau dibuang. Maks 5 MB, sisi 64-4096 px. |
| **Menyajikan foto** | Nama file acak (UUID), `nosniff`, `CSP: sandbox`. Foto yang belum disetujui hanya bisa dilihat pemilik dan mod. Foto yang ditolak langsung dihapus. |
| **Teks (caption, komentar, nama)** | Karakter tak terlihat & pembalik teks dibuang. Ditampilkan sebagai teks biasa (tidak pernah jadi HTML). Komentar: maks 300 karakter, tanpa link, filter kata kasar (`src/kata.js`, termasuk samaran huruf/angka, huruf Kiril, huruf tak terlihat). |
| **Halaman galeri & mod** | CSP: browser hanya menjalankan script dari situs ini (+ Turnstile di galeri). Script sisipan, `onerror`, dan kiriman data ke situs lain diblokir. |
| **Database** | Semua query memakai parameter (`?1`, `?2`), tidak pernah menyusun SQL dari teks pengguna. |
| **Batas kecepatan** | Upload: 5/24 jam + 5/10 menit (atomik) + maks 10 menunggu. Komentar: 5/menit, 50/hari. Suka: 120/jam. Laporan: 10/jam, sekali per konten. |
| **Anti-bot** | Turnstile di setiap upload; token harus dibuat di situs sendiri. |
| **Penyamaran** | Nickname punya pemilik (akun pertama yang memakai), maks 3 per akun; nick foto arsip dipesan. |
| **Moderasi** | Antrean wajib dicek mod; komentar otomatis disembunyikan setelah 3 laporan; semua tindakan mod tercatat di Riwayat. |
| **Notifikasi mod** | Webhook hanya berisi jumlah + link, tanpa teks dari pengguna, tidak bisa mention (`allowed_mentions` kosong), maks 1x per 10 menit per jenis. |
| **Kiriman raksasa** | JSON maks 4 KB dicek SEBELUM dibaca; upload tanpa ukuran ditolak. |
| **Login uji** | Hanya hidup kalau `DEV_LOGIN=1` **dan** alamat dibuka dari localhost **dan** `SITUS` localhost. Tidak bisa hidup di chaatown.my.id. |
| **Rahasia** | Client Secret, webhook, kunci Turnstile hanya di `.dev.vars` (lokal) / secret Cloudflare (G6). `.gitignore` menjaganya; riwayat git sudah diperiksa bersih. |

## Uji yang bisa dijalankan ulang

Dari folder `_api`, saat `npm.cmd run dev` jalan di terminal lain:

```
npm.cmd run uji      # 134 uji fungsi dapur (file, login, upload, mod, sosial)
npm.cmd run serang   # 40 uji serangan (kiriman raksasa, SQL, curi file, CSRF, IDOR, race condition, dll.)
```

Keduanya membuat akun & foto uji di database lokal, dan bisa memicu 1 notifikasi uji ke channel mod kalau webhook diisi.

## Batasan yang diketahui (diterima)

- Filter kata kasar bisa diakali dengan cara yang sangat kreatif (misalnya kata dipotong spasi tidak beraturan). Itu sebabnya ada tombol Laporkan + sembunyi otomatis + mod.
- Link yang disamarkan (`situs[titik]com`) tidak terdeteksi otomatis.
- Halaman situs dihosting GitHub Pages, jadi pengaman dipasang lewat tag `<meta>` (bukan header). `frame-ancestors` tidak bisa lewat meta, tetapi cookie `SameSite=Lax` sudah mencegah aksi mod lewat iframe situs lain.
- Saat dijalankan lokal, `wrangler dev` sendiri menulis ulang Origin `https://localhost:<port>` menjadi `http://`. Ini perilaku alat lokal, bukan di Cloudflare.

## WAJIB dicek sebelum online (Fase G6)

- [ ] `DEV_LOGIN` **tidak** diisi di Cloudflare.
- [ ] `SITUS` = `https://chaatown.my.id` (pakai https).
- [ ] Kunci Turnstile **asli** (site key di `wrangler.jsonc`, secret lewat `wrangler secret put TURNSTILE_SECRET`), domain chaatown.my.id terdaftar di widget Turnstile.
- [ ] `DISCORD_CLIENT_SECRET` dan `DISCORD_WEBHOOK_MOD` lewat `wrangler secret put`, bukan di file.
- [ ] Redirect OAuth Discord ditambah `https://chaatown.my.id/api/auth/callback`.
- [ ] `MOD_ROLE_IDS` benar.
- [ ] Worker hanya menangani `/api/*` dan `/img/*`; file website tetap dari GitHub Pages (jangan ikut mengunggah folder proyek sebagai assets).
- [ ] Jalankan `npm.cmd run serang` sekali ke server asli **sebelum** diumumkan (dengan login uji mati, uji yang butuh login akan gagal, itu normal; bagian curi file, CSRF, dan header harus lolos).
- [ ] Catatan DNS tunnel yang sudah ada **tidak diubah**.
