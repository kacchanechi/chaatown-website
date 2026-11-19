-- Galeri ChaaTown: tabel awal (Fase G2)

-- Akun Discord yang pernah masuk
CREATE TABLE pengguna (
  id        TEXT PRIMARY KEY,           -- ID akun Discord
  nama      TEXT NOT NULL,              -- nama tampilan (nick server / nama global / username)
  avatar    TEXT,                       -- kode avatar Discord (bukan gambar)
  dibuat    INTEGER NOT NULL,           -- waktu pertama masuk (detik unix)
  diblokir  INTEGER NOT NULL DEFAULT 0  -- 1 = tidak boleh upload/masuk
);

-- Sesi login. id = sidik (SHA-256) kunci di cookie, bukan kuncinya sendiri.
CREATE TABLE sesi (
  id           TEXT PRIMARY KEY,
  pengguna_id  TEXT NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  mod          INTEGER NOT NULL DEFAULT 0,
  kedaluwarsa  INTEGER NOT NULL
);
CREATE INDEX sesi_pengguna ON sesi(pengguna_id);

-- Foto. Baru tampil di galeri kalau status = 'tayang' (disetujui mod).
CREATE TABLE foto (
  id           TEXT PRIMARY KEY,        -- UUID acak, juga nama file
  pengguna_id  TEXT NOT NULL REFERENCES pengguna(id),
  nick         TEXT NOT NULL,           -- nickname Minecraft yang ditulis pengupload
  caption      TEXT NOT NULL DEFAULT '',
  jenis        TEXT NOT NULL CHECK (jenis IN ('webp', 'jpg')),
  status       TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'tayang', 'ditolak')),
  lebar        INTEGER NOT NULL,
  tinggi       INTEGER NOT NULL,
  ukuran       INTEGER NOT NULL,        -- byte
  dibuat       INTEGER NOT NULL,
  dicek_oleh   TEXT,                    -- ID Discord mod yang menyetujui/menolak (Fase G3)
  dicek_pada   INTEGER,
  alasan       TEXT                     -- alasan ditolak (Fase G3)
);
CREATE INDEX foto_status ON foto(status, dibuat DESC);
CREATE INDEX foto_pengguna ON foto(pengguna_id, dibuat DESC);
