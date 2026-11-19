/* =====================================================================
   ChaaTown - dapur galeri (Cloudflare Worker)
   Alamat:
     GET  /api/saya            status login + kuota upload
     GET  /api/foto            foto yang sudah disetujui mod
     POST /api/foto            upload foto (masuk antrean)
     GET  /api/foto/saya       foto milikku (semua status)
     GET  /api/auth/masuk      login pakai Discord
     GET  /api/auth/callback   (dipanggil Discord setelah login)
     POST /api/auth/keluar     logout
     GET  /img/<id>.<jenis>    file gambar
   Khusus mod (Fase G3):
     GET  /api/mod/foto?status=menunggu|tayang|ditolak
     POST /api/mod/foto        { id, aksi: setujui|tolak, alasan }
     GET  /api/mod/pengguna    akun yang diblokir
     POST /api/mod/pengguna    { id, blokir: true|false, alasan }
     GET  /api/mod/riwayat     100 tindakan mod terakhir
   Sosial (Fase G4):
     POST /api/foto/suka            { id, suka }
     GET  /api/foto/komentar?id=    komentar sebuah foto
     POST /api/foto/komentar        { id, isi }
     POST /api/foto/komentar/hapus  { id }  (komentar sendiri)
     POST /api/lapor                { jenis: foto|komentar, id, alasan }
     GET  /api/mod/laporan  ·  POST /api/mod/laporan { jenis, id, aksi: tindak|abaikan, alasan }
     POST /api/mod/komentar { id, alasan }   (mod menyembunyikan komentar)
     GET  /api/mod/nick     ·  POST /api/mod/nick { nick, aksi: lepas }
   Selain itu: file website biasa (hanya saat dijalankan di komputer).
   ===================================================================== */
import { galat } from './alat.js';
import { masuk, callback, keluar, devMasuk } from './masuk.js';
import { saya, daftar, upload, punyaSaya, gambar } from './foto.js';
import { daftarMod, aksiFoto, daftarDiblokir, aksiPengguna, riwayat, daftarLaporan, aksiLaporan, sembunyikanKomentar, daftarNick, aksiNick } from './mod.js';
import { suka, daftarKomentar, tulisKomentar, hapusKomentar, lapor } from './sosial.js';

const RUTE = {
  'GET /api/saya': saya,
  'GET /api/foto': daftar,
  'POST /api/foto': upload,
  'GET /api/foto/saya': punyaSaya,
  'GET /api/auth/masuk': masuk,
  'GET /api/auth/callback': callback,
  'POST /api/auth/keluar': keluar,
  'GET /api/auth/dev': devMasuk,
  'GET /api/mod/foto': daftarMod,
  'POST /api/mod/foto': aksiFoto,
  'GET /api/mod/pengguna': daftarDiblokir,
  'POST /api/mod/pengguna': aksiPengguna,
  'GET /api/mod/riwayat': riwayat,
  // Fase G4: sosial
  'POST /api/foto/suka': suka,
  'GET /api/foto/komentar': daftarKomentar,
  'POST /api/foto/komentar': tulisKomentar,
  'POST /api/foto/komentar/hapus': hapusKomentar,
  'POST /api/lapor': lapor,
  'GET /api/mod/laporan': daftarLaporan,
  'POST /api/mod/laporan': aksiLaporan,
  'POST /api/mod/komentar': sembunyikanKomentar,
  'GET /api/mod/nick': daftarNick,
  'POST /api/mod/nick': aksiNick
};

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), p = url.pathname;
    try {
      if (p.startsWith('/img/')) return req.method === 'GET' ? await gambar(req, env, p.slice(5)) : galat(405, 'Metode tidak diizinkan.');
      const h = RUTE[req.method + ' ' + p];
      if (h) return await h(req, env, ctx, url);
      if (p.startsWith('/api/')) return galat(404, 'Alamat API tidak dikenal.');
      return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 });
    } catch (e) {
      console.error(e && e.stack || e);
      return galat(500, 'Terjadi kesalahan di server. Coba lagi nanti.');
    }
  }
};
