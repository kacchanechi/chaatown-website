-- Galeri ChaaTown: suka, komentar, laporan, batas kecepatan, kepemilikan nickname (Fase G4)

-- Suka: satu akun hanya bisa menyukai satu foto sekali
CREATE TABLE suka (
  foto_id      TEXT NOT NULL REFERENCES foto(id),
  pengguna_id  TEXT NOT NULL REFERENCES pengguna(id),
  dibuat       INTEGER NOT NULL,
  PRIMARY KEY (foto_id, pengguna_id)
);

-- Komentar: langsung tampil, bisa disembunyikan mod (atau otomatis setelah beberapa laporan)
CREATE TABLE komentar (
  id           TEXT PRIMARY KEY,
  foto_id      TEXT NOT NULL REFERENCES foto(id),
  pengguna_id  TEXT NOT NULL REFERENCES pengguna(id),
  isi          TEXT NOT NULL,
  dibuat       INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'tampil' CHECK (status IN ('tampil', 'disembunyikan')),
  dicek_oleh   TEXT,
  dicek_pada   INTEGER,
  alasan       TEXT
);
CREATE INDEX komentar_foto ON komentar(foto_id, dibuat);
CREATE INDEX komentar_pengguna ON komentar(pengguna_id, dibuat DESC);

-- Laporan dari pemain. Satu akun hanya bisa melaporkan satu konten sekali.
CREATE TABLE laporan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis       TEXT NOT NULL CHECK (jenis IN ('foto', 'komentar')),
  target_id   TEXT NOT NULL,
  pelapor_id  TEXT NOT NULL REFERENCES pengguna(id),
  alasan      TEXT NOT NULL,
  dibuat      INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'selesai')),
  UNIQUE (jenis, target_id, pelapor_id)
);
CREATE INDEX laporan_status ON laporan(status, dibuat);

-- Batas kecepatan (misalnya 5 komentar per menit). kunci = "jenis:id akun"
CREATE TABLE batas (
  kunci   TEXT PRIMARY KEY,
  mulai   INTEGER NOT NULL,
  jumlah  INTEGER NOT NULL
);

-- Kepemilikan nickname Minecraft: nick pertama dipakai siapa, jadi milik akun Discord itu.
-- pengguna_id kosong = dipesan (nick pemilik foto arsip), hanya bisa dipakai setelah dilepas mod.
CREATE TABLE nick (
  nick         TEXT PRIMARY KEY,   -- huruf kecil, untuk pencocokan
  tampil       TEXT NOT NULL,      -- tulisan aslinya, misalnya "BlaZeSZ"
  pengguna_id  TEXT REFERENCES pengguna(id),
  dibuat       INTEGER NOT NULL
);
CREATE INDEX nick_pengguna ON nick(pengguna_id);

-- Nick yang sudah dipakai di foto upload sebelumnya: jadi milik pengupload pertamanya
INSERT OR IGNORE INTO nick (nick, tampil, pengguna_id, dibuat)
  SELECT lower(f.nick), f.nick, f.pengguna_id, f.dibuat FROM foto f
  WHERE f.dibuat = (SELECT MIN(g.dibuat) FROM foto g WHERE lower(g.nick) = lower(f.nick))
  ORDER BY f.dibuat;

-- Nick pemilik 12 foto arsip: dipesan
INSERT OR IGNORE INTO nick (nick, tampil, pengguna_id, dibuat) VALUES
  ('ayamkekar', 'AyamKekar', NULL, 0),
  ('gikx', 'Gikx', NULL, 0),
  ('blazesz', 'BlaZeSZ', NULL, 0),
  ('foksunee', 'Foksunee', NULL, 0),
  ('veneznia', 'Veneznia', NULL, 0);
