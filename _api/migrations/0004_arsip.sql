-- Galeri ChaaTown: 12 foto lama jadi post (Fase G4b), supaya bisa disukai & dikomentari.
-- File fotonya TIDAK dipindah: tetap file situs di folder galeri/ (aset terkunci, dicek _tools/cek-aset.ps1).
-- ID dibuat tetap (bukan acak) supaya sama persis di komputer lokal dan di Cloudflare.

-- Path file situs untuk foto lama (foto upload biasa: kosong, filenya di R2)
ALTER TABLE foto ADD COLUMN berkas TEXT;

-- Pemilik khusus "Galeri lama": bukan akun Discord (ID bukan angka), jadi tidak bisa login maupun diblokir
INSERT OR IGNORE INTO pengguna (id, nama, avatar, dibuat, diblokir) VALUES ('arsip', 'Galeri lama', NULL, 0, 0);

INSERT OR IGNORE INTO foto (id, pengguna_id, nick, caption, jenis, status, lebar, tinggi, ukuran, dibuat, berkas) VALUES
  ('a2c1f000-0000-4000-8000-000000000001', 'arsip', 'AyamKekar', 'sepertinya saya sudah muak dengan perkulian ini..', 'webp', 'tayang', 1600, 835, 105554, 1791158400, 'galeri/senja-bangunan-jepang.webp'),
  ('a2c1f000-0000-4000-8000-000000000002', 'arsip', 'Gikx', 'New Empire', 'webp', 'tayang', 1440, 837, 65636, 1791158340, 'galeri/lodge-salju.webp'),
  ('a2c1f000-0000-4000-8000-000000000003', 'arsip', 'AyamKekar', 'fotbar atmin dan anyak anyak', 'webp', 'tayang', 1600, 876, 144102, 1791158280, 'galeri/foto-bareng-malam.webp'),
  ('a2c1f000-0000-4000-8000-000000000004', 'arsip', 'Foksunee', 'p', 'webp', 'tayang', 1600, 876, 124002, 1791158220, 'galeri/balkon-bareng.webp'),
  ('a2c1f000-0000-4000-8000-000000000005', 'arsip', 'BlaZeSZ', 'saksi tragedi 17 september', 'webp', 'tayang', 1440, 837, 56492, 1791158160, 'galeri/kumpul-salju.webp'),
  ('a2c1f000-0000-4000-8000-000000000006', 'arsip', 'Veneznia', 'Singgasana Veneznia', 'webp', 'tayang', 1365, 767, 120778, 1791158100, 'galeri/singgasana.webp'),
  ('a2c1f000-0000-4000-8000-000000000007', 'arsip', 'BlaZeSZ', 'ilham ilmu hytam', 'webp', 'tayang', 1440, 837, 128270, 1791158040, 'galeri/santai-teras.webp'),
  ('a2c1f000-0000-4000-8000-000000000008', 'arsip', 'BlaZeSZ', 'Onsen', 'webp', 'tayang', 1440, 837, 57576, 1791157980, 'galeri/tavern-malam.webp'),
  ('a2c1f000-0000-4000-8000-000000000009', 'arsip', 'Gikx', 'gede juga kapak gwehh', 'webp', 'tayang', 1341, 767, 92462, 1791157920, 'galeri/senjata-merah.webp'),
  ('a2c1f000-0000-4000-8000-00000000000a', 'arsip', 'BlaZeSZ & Foksunee', 'blublub.. blubublubub!', 'webp', 'tayang', 1440, 837, 39420, 1791157860, 'galeri/pertarungan-gua.webp'),
  ('a2c1f000-0000-4000-8000-00000000000b', 'arsip', 'Gikx', '3 portal di pulau Kepunyaan', 'webp', 'tayang', 1365, 767, 83080, 1791157800, 'galeri/malam-hujan-portal.webp'),
  ('a2c1f000-0000-4000-8000-00000000000c', 'arsip', 'Veneznia', 'Urraa!', 'webp', 'tayang', 1600, 841, 94420, 1791157740, 'galeri/patung-batu.webp');
