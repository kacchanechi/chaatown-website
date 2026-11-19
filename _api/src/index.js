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
   Selain itu: file website biasa (hanya saat dijalankan di komputer).
   ===================================================================== */
import { galat } from './alat.js';
import { masuk, callback, keluar, devMasuk } from './masuk.js';
import { saya, daftar, upload, punyaSaya, gambar } from './foto.js';

const RUTE = {
  'GET /api/saya': saya,
  'GET /api/foto': daftar,
  'POST /api/foto': upload,
  'GET /api/foto/saya': punyaSaya,
  'GET /api/auth/masuk': masuk,
  'GET /api/auth/callback': callback,
  'POST /api/auth/keluar': keluar,
  'GET /api/auth/dev': devMasuk
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
