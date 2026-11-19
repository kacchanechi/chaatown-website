/* =====================================================================
   sosial.js - suka, komentar, dan laporan (Fase G4)

   - Semua tindakan butuh login (member server Discord ChaaTown) dan
     hanya berlaku untuk foto yang sudah tayang.
   - Komentar langsung tampil, tapi dijaga: maks 300 karakter, tanpa link,
     filter kata kasar (kata.js), maks 5 per menit & 50 per hari.
   - Laporan: satu akun hanya sekali per konten. Komentar yang dilaporkan
     3 akun berbeda otomatis disembunyikan sampai dicek mod.
   ===================================================================== */
import { json, galat, sekarang, asalSah, rapikanTeks, bacaJson, cekBatas } from './alat.js';
import { sesiDari } from './masuk.js';
import { kataKasar } from './kata.js';
import { kabariMod, ALASAN_OTOMATIS } from './mod.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAKS_KOMENTAR = 300;
const LAPOR_OTOMATIS = 3;
const ADA_LINK = /(https?:\/\/|www\.|discord\.gg\/|\b[\w-]+\.(com|net|org|id|gg|io|xyz|me|link|ly)\b)/i;

/** Pengecekan bersama untuk tindakan yang mengubah data. Hasil: sesi, atau Response galat. */
async function perluMasuk(req, env) {
  if (!asalSah(req, env)) return galat(403, 'Permintaan ditolak.');
  const s = await sesiDari(req, env);
  if (!s) return galat(401, 'Masuk dengan Discord dulu.');
  if (s.diblokir) return galat(403, 'Akunmu tidak bisa memakai galeri.');
  return s;
}
const fotoTayang = (env, id) => UUID.test(String(id || ''))
  ? env.DB.prepare("SELECT id, pengguna_id FROM foto WHERE id = ?1 AND status = 'tayang'").bind(id).first()
  : null;

/** POST /api/foto/suka  { id, suka: true|false } */
export async function suka(req, env) {
  const s = await perluMasuk(req, env); if (s instanceof Response) return s;
  const b = await bacaJson(req);
  if (!b || typeof b.suka !== 'boolean') return galat(400, 'Permintaan tidak valid.');
  const f = await fotoTayang(env, b.id);
  if (!f) return galat(404, 'Foto tidak ditemukan.');
  if (!(await cekBatas(env, 'suka:' + s.id, 120, 3600))) return galat(429, 'Terlalu sering. Coba lagi nanti.');
  await (b.suka
    ? env.DB.prepare('INSERT OR IGNORE INTO suka (foto_id, pengguna_id, dibuat) VALUES (?1, ?2, ?3)').bind(f.id, s.id, sekarang())
    : env.DB.prepare('DELETE FROM suka WHERE foto_id = ?1 AND pengguna_id = ?2').bind(f.id, s.id)).run();
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM suka WHERE foto_id = ?1').bind(f.id).first()).n;
  return json({ ok: true, suka: n, disukai: b.suka });
}

/** GET /api/foto/komentar?id=<foto> -> komentar yang tampil (terlama dulu) */
export async function daftarKomentar(req, env, ctx, url) {
  const f = await fotoTayang(env, url.searchParams.get('id'));
  if (!f) return galat(404, 'Foto tidak ditemukan.');
  const s = await sesiDari(req, env);
  const { results } = await env.DB.prepare(
    "SELECT k.id, k.isi, k.dibuat, p.id AS pid, p.nama, p.avatar FROM komentar k JOIN pengguna p ON p.id = k.pengguna_id " +
    "WHERE k.foto_id = ?1 AND k.status = 'tampil' ORDER BY k.dibuat, k.rowid LIMIT 200"
  ).bind(f.id).all();
  return json({
    komentar: results.map(r => ({ id: r.id, isi: r.isi, dibuat: r.dibuat, penulis: { id: r.pid, nama: r.nama, avatar: r.avatar }, milikku: !!s && s.id === r.pid })),
    masuk: !!s, mod: !!(s && s.mod)
  });
}

/** POST /api/foto/komentar  { id, isi } */
export async function tulisKomentar(req, env) {
  const s = await perluMasuk(req, env); if (s instanceof Response) return s;
  const b = await bacaJson(req);
  if (!b) return galat(400, 'Permintaan tidak valid.');
  const f = await fotoTayang(env, b.id);
  if (!f) return galat(404, 'Foto tidak ditemukan.');
  const isi = rapikanTeks(b.isi, MAKS_KOMENTAR + 1);
  if (!isi) return galat(400, 'Tulis komentarnya dulu.');
  if (isi.length > MAKS_KOMENTAR) return galat(400, 'Komentar maksimal ' + MAKS_KOMENTAR + ' karakter.');
  if (ADA_LINK.test(isi)) return galat(400, 'Komentar tidak boleh berisi link.');
  if (kataKasar(isi)) return galat(400, 'Komentarmu mengandung kata yang tidak diizinkan. Yuk, pakai bahasa yang lebih ramah.');
  if (!(await cekBatas(env, 'komen-menit:' + s.id, 5, 60))) return galat(429, 'Pelan-pelan, ya. Tunggu sebentar sebelum berkomentar lagi.');
  if (!(await cekBatas(env, 'komen-hari:' + s.id, 50, 86400))) return galat(429, 'Batas komentar hari ini sudah habis.');
  const id = crypto.randomUUID(), t = sekarang();
  await env.DB.prepare('INSERT INTO komentar (id, foto_id, pengguna_id, isi, dibuat) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, f.id, s.id, isi, t).run();
  return json({ ok: true, komentar: { id, isi, dibuat: t, penulis: { id: s.id, nama: s.nama, avatar: s.avatar }, milikku: true } }, 201);
}

/** POST /api/foto/komentar/hapus  { id } -> penulis menghapus komentarnya sendiri */
export async function hapusKomentar(req, env) {
  const s = await perluMasuk(req, env); if (s instanceof Response) return s;
  const b = await bacaJson(req);
  if (!b || !UUID.test(String(b.id || ''))) return galat(400, 'Permintaan tidak valid.');
  const k = await env.DB.prepare('SELECT pengguna_id FROM komentar WHERE id = ?1').bind(b.id).first();
  if (!k) return galat(404, 'Komentar tidak ditemukan.');
  if (k.pengguna_id !== s.id) return galat(403, 'Kamu hanya bisa menghapus komentarmu sendiri.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM komentar WHERE id = ?1').bind(b.id),
    env.DB.prepare("UPDATE laporan SET status = 'selesai' WHERE jenis = 'komentar' AND target_id = ?1").bind(b.id)
  ]);
  return json({ ok: true });
}

/** POST /api/lapor  { jenis: 'foto'|'komentar', id, alasan } */
export async function lapor(req, env, ctx) {
  const s = await perluMasuk(req, env); if (s instanceof Response) return s;
  const b = await bacaJson(req);
  if (!b || !['foto', 'komentar'].includes(b.jenis) || !UUID.test(String(b.id || ''))) return galat(400, 'Permintaan tidak valid.');
  const alasan = rapikanTeks(b.alasan, 150);
  if (alasan.length < 3) return galat(400, 'Pilih alasan laporannya.');
  const target = b.jenis === 'foto'
    ? await fotoTayang(env, b.id)
    : await env.DB.prepare("SELECT k.id, k.pengguna_id FROM komentar k JOIN foto f ON f.id = k.foto_id WHERE k.id = ?1 AND k.status = 'tampil' AND f.status = 'tayang'").bind(b.id).first();
  if (!target) return galat(404, b.jenis === 'foto' ? 'Foto tidak ditemukan.' : 'Komentar tidak ditemukan.');
  if (target.pengguna_id === s.id) return galat(400, 'Ini kontenmu sendiri.');
  if (!(await cekBatas(env, 'lapor:' + s.id, 10, 3600))) return galat(429, 'Terlalu banyak laporan. Coba lagi nanti.');
  const r = await env.DB.prepare('INSERT OR IGNORE INTO laporan (jenis, target_id, pelapor_id, alasan, dibuat) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(b.jenis, b.id, s.id, alasan, sekarang()).run();
  if (!r.meta.changes) return galat(409, 'Kamu sudah melaporkan ini. Terima kasih, mod akan mengeceknya.');

  let disembunyikan = false;
  if (b.jenis === 'komentar') {
    const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM laporan WHERE jenis = 'komentar' AND target_id = ?1 AND status = 'baru'").bind(b.id).first()).n;
    if (n >= LAPOR_OTOMATIS) {
      const u = await env.DB.prepare("UPDATE komentar SET status = 'disembunyikan', alasan = ?2, dicek_pada = ?3 WHERE id = ?1 AND status = 'tampil'")
        .bind(b.id, ALASAN_OTOMATIS, sekarang()).run();
      disembunyikan = u.meta.changes > 0;
    }
  }
  ctx.waitUntil(kabariMod(env, fetch, 'laporan').catch(e => console.error('notifikasi laporan gagal:', e && e.message)));
  return json({ ok: true, disembunyikan }, 201);
}
