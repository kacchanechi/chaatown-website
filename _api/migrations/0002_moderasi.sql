-- Galeri ChaaTown: moderasi (Fase G3)

-- Riwayat tindakan mod: siapa melakukan apa, kapan, dan alasannya (supaya bisa dipertanggungjawabkan)
CREATE TABLE log_mod (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mod_id       TEXT NOT NULL,     -- ID Discord mod
  mod_nama     TEXT NOT NULL,     -- nama mod saat itu
  aksi         TEXT NOT NULL,     -- setujui | tolak | turunkan | blokir | buka-blokir
  foto_id      TEXT,
  pengguna_id  TEXT,              -- pemilik foto / akun yang diblokir
  alasan       TEXT,
  waktu        INTEGER NOT NULL
);
CREATE INDEX log_mod_waktu ON log_mod(waktu DESC);

-- Pengaturan kecil (misalnya kapan notifikasi Discord terakhir dikirim)
CREATE TABLE pengaturan (
  kunci  TEXT PRIMARY KEY,
  nilai  TEXT NOT NULL
);
