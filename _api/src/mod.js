/* =====================================================================
   mod.js - moderasi galeri (Fase G3)

   - Hanya akun Discord dengan role mod (MOD_ROLE_IDS) yang bisa memakai.
     Sesi mod hanya 12 jam, jadi role yang dicabut cepat ikut tidak berlaku.
   - Foto ditolak / diturunkan: FILE GAMBARNYA LANGSUNG DIHAPUS. Yang tersisa
     hanya catatan + alasan, supaya pemiliknya tahu kenapa.
   - Setiap tindakan dicatat di log_mod.
   - Notifikasi ke channel mod lewat webhook: paling sering 1x per 10 menit,
     tanpa isi dari pengupload (jadi tidak bisa disalahgunakan untuk mention).
   ===================================================================== */
import { json, galat, sekarang, asalSah, rapikanTeks, bacaJson } from './alat.js';
import { sesiDari } from './masuk.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ID_DISCORD = /^\d{5,20}$/;

async function modDari(req, env) {
  const s = await sesiDari(req, env);
  return s && s.mod && !s.diblokir ? s : null;
}
const catat = (env, m, aksi, { foto = null, pengguna = null, alasan = null } = {}) =>
  env.DB.prepare('INSERT INTO log_mod (mod_id, mod_nama, aksi, foto_id, pengguna_id, alasan, waktu) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(m.id, m.nama, aksi, foto, pengguna, alasan, sekarang());

/** Jumlah foto per status (untuk angka di tab) */
async function jumlah(env) {
  const { results } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM foto GROUP BY status').all();
  const o = { menunggu: 0, tayang: 0, ditolak: 0 };
  for (const r of results) o[r.status] = r.n;
  o.diblokir = (await env.DB.prepare('SELECT COUNT(*) AS n FROM pengguna WHERE diblokir = 1').first()).n;
  o.laporan = await jumlahLaporan(env);
  return o;
}
export const jumlahMenunggu = async env => (await env.DB.prepare("SELECT COUNT(*) AS n FROM foto WHERE status = 'menunggu'").first()).n;
// Jumlah konten yang punya laporan terbuka (bukan jumlah laporannya)
export const jumlahLaporan = async env => (await env.DB.prepare("SELECT COUNT(*) AS n FROM (SELECT 1 FROM laporan WHERE status = 'baru' GROUP BY jenis, target_id)").first()).n;

/** Turunkan / tolak foto: status jadi ditolak, file dihapus, laporan ditutup, dicatat. */
async function turunkanFoto(env, m, f, alasan) {
  const r = await env.DB.prepare("UPDATE foto SET status = 'ditolak', dicek_oleh = ?2, dicek_pada = ?3, alasan = ?4 WHERE id = ?1 AND status = ?5")
    .bind(f.id, m.id, sekarang(), alasan, f.status).run();
  if (!r.meta.changes) return false;
  await env.FOTO.delete('foto/' + f.id + '.' + f.jenis); // konten yang ditolak tidak disimpan
  await env.DB.batch([
    env.DB.prepare("UPDATE laporan SET status = 'selesai' WHERE jenis = 'foto' AND target_id = ?1 AND status = 'baru'").bind(f.id),
    catat(env, m, f.status === 'tayang' ? 'turunkan' : 'tolak', { foto: f.id, pengguna: f.pengguna_id, alasan })
  ]);
  return true;
}

/** GET /api/mod/foto?status=menunggu|tayang|ditolak */
export async function daftarMod(req, env, ctx, url) {
  if (!(await modDari(req, env))) return galat(403, 'Halaman ini khusus mod.');
  const status = url.searchParams.get('status') || 'menunggu';
  if (!['menunggu', 'tayang', 'ditolak'].includes(status)) return galat(400, 'Status tidak dikenal.');
  const urut = status === 'menunggu' ? 'ASC' : 'DESC'; // antrean: yang paling lama menunggu dulu
  const { results } = await env.DB.prepare(
    'SELECT f.id, f.jenis, f.nick, f.caption, f.lebar, f.tinggi, f.ukuran, f.dibuat, f.dicek_pada, f.alasan, ' +
    'p.id AS pid, p.nama, p.avatar, p.diblokir, c.nama AS dicek_nama ' +
    'FROM foto f JOIN pengguna p ON p.id = f.pengguna_id LEFT JOIN pengguna c ON c.id = f.dicek_oleh ' +
    'WHERE f.status = ?1 ORDER BY f.dibuat ' + urut + ' LIMIT 50'
  ).bind(status).all();
  return json({
    jumlah: await jumlah(env),
    foto: results.map(r => ({
      id: r.id, status, src: status === 'ditolak' ? null : '/img/' + r.id + '.' + r.jenis,
      nick: r.nick, caption: r.caption, lebar: r.lebar, tinggi: r.tinggi, ukuran: r.ukuran, dibuat: r.dibuat,
      dicekPada: r.dicek_pada, dicekOleh: r.dicek_nama, alasan: r.alasan,
      pengguna: { id: r.pid, nama: r.nama, avatar: r.avatar, diblokir: !!r.diblokir }
    }))
  });
}

/** POST /api/mod/foto  { id, aksi: 'setujui' | 'tolak', alasan } */
export async function aksiFoto(req, env) {
  if (!asalSah(req, env)) return galat(403, 'Permintaan ditolak.');
  const m = await modDari(req, env);
  if (!m) return galat(403, 'Halaman ini khusus mod.');
  const b = await bacaJson(req);
  if (!b || !UUID.test(String(b.id || ''))) return galat(400, 'Permintaan tidak valid.');
  const f = await env.DB.prepare('SELECT id, jenis, status, pengguna_id FROM foto WHERE id = ?1').bind(b.id).first();
  if (!f) return galat(404, 'Foto tidak ditemukan.');
  const t = sekarang();

  if (b.aksi === 'setujui') {
    if (f.status !== 'menunggu') return galat(409, 'Foto ini sudah dicek mod lain. Muat ulang daftarnya.');
    const r = await env.DB.prepare("UPDATE foto SET status = 'tayang', dicek_oleh = ?2, dicek_pada = ?3, alasan = NULL WHERE id = ?1 AND status = 'menunggu'")
      .bind(f.id, m.id, t).run();
    if (!r.meta.changes) return galat(409, 'Foto ini sudah dicek mod lain. Muat ulang daftarnya.');
    await catat(env, m, 'setujui', { foto: f.id, pengguna: f.pengguna_id }).run();
    return json({ ok: true, status: 'tayang' });
  }

  if (b.aksi === 'tolak') {
    const alasan = rapikanTeks(b.alasan, 150);
    if (alasan.length < 3) return galat(400, 'Tulis alasan penolakannya.');
    if (f.status === 'ditolak') return galat(409, 'Foto ini sudah ditolak.');
    if (!(await turunkanFoto(env, m, f, alasan))) return galat(409, 'Status foto sudah berubah. Muat ulang daftarnya.');
    return json({ ok: true, status: 'ditolak' });
  }
  return galat(400, 'Aksi tidak dikenal.');
}

/** GET /api/mod/pengguna -> akun yang diblokir */
export async function daftarDiblokir(req, env) {
  if (!(await modDari(req, env))) return galat(403, 'Halaman ini khusus mod.');
  const { results } = await env.DB.prepare(
    "SELECT p.id, p.nama, p.avatar, (SELECT l.alasan FROM log_mod l WHERE l.pengguna_id = p.id AND l.aksi = 'blokir' ORDER BY l.waktu DESC LIMIT 1) AS alasan " +
    'FROM pengguna p WHERE p.diblokir = 1 ORDER BY p.nama LIMIT 200'
  ).all();
  return json({ jumlah: await jumlah(env), pengguna: results });
}

/** POST /api/mod/pengguna  { id, blokir: true|false, alasan } */
export async function aksiPengguna(req, env) {
  if (!asalSah(req, env)) return galat(403, 'Permintaan ditolak.');
  const m = await modDari(req, env);
  if (!m) return galat(403, 'Halaman ini khusus mod.');
  const b = await bacaJson(req);
  if (!b || !ID_DISCORD.test(String(b.id || '')) || typeof b.blokir !== 'boolean') return galat(400, 'Permintaan tidak valid.');
  if (b.id === m.id) return galat(400, 'Kamu tidak bisa memblokir akunmu sendiri.');
  const p = await env.DB.prepare('SELECT id FROM pengguna WHERE id = ?1').bind(b.id).first();
  if (!p) return galat(404, 'Akun tidak ditemukan.');
  // Catatan: komentar yang disembunyikan karena blokir tidak otomatis muncul lagi saat blokir dibuka.

  if (!b.blokir) {
    await env.DB.batch([
      env.DB.prepare('UPDATE pengguna SET diblokir = 0 WHERE id = ?1').bind(p.id),
      catat(env, m, 'buka-blokir', { pengguna: p.id })
    ]);
    return json({ ok: true, diblokir: false });
  }
  const alasan = rapikanTeks(b.alasan, 150);
  if (alasan.length < 3) return galat(400, 'Tulis alasan pemblokirannya.');
  const { results: antre } = await env.DB.prepare("SELECT id, jenis FROM foto WHERE pengguna_id = ?1 AND status = 'menunggu'").bind(p.id).all();
  const t = sekarang();
  await env.DB.batch([
    env.DB.prepare('UPDATE pengguna SET diblokir = 1 WHERE id = ?1').bind(p.id),
    env.DB.prepare('DELETE FROM sesi WHERE pengguna_id = ?1').bind(p.id), // langsung keluar dari semua perangkat
    env.DB.prepare("UPDATE foto SET status = 'ditolak', dicek_oleh = ?2, dicek_pada = ?3, alasan = 'Akun diblokir' WHERE pengguna_id = ?1 AND status = 'menunggu'").bind(p.id, m.id, t),
    env.DB.prepare("UPDATE komentar SET status = 'disembunyikan', dicek_oleh = ?2, dicek_pada = ?3, alasan = 'Akun diblokir' WHERE pengguna_id = ?1 AND status = 'tampil'").bind(p.id, m.id, t),
    catat(env, m, 'blokir', { pengguna: p.id, alasan })
  ]);
  if (antre.length) await env.FOTO.delete(antre.map(f => 'foto/' + f.id + '.' + f.jenis));
  return json({ ok: true, diblokir: true, fotoDitolak: antre.length });
}

/** GET /api/mod/riwayat -> 100 tindakan mod terakhir */
export async function riwayat(req, env) {
  if (!(await modDari(req, env))) return galat(403, 'Halaman ini khusus mod.');
  const { results } = await env.DB.prepare(
    'SELECT l.id, l.mod_nama, l.aksi, l.foto_id, l.pengguna_id, l.alasan, l.waktu, p.nama AS pengguna_nama ' +
    'FROM log_mod l LEFT JOIN pengguna p ON p.id = l.pengguna_id ORDER BY l.waktu DESC, l.id DESC LIMIT 100'
  ).all();
  return json({ jumlah: await jumlah(env), riwayat: results });
}

/* ---------- Laporan dari pemain (Fase G4) ---------- */

/** GET /api/mod/laporan -> konten yang dilaporkan (paling banyak laporan dulu) */
export async function daftarLaporan(req, env) {
  if (!(await modDari(req, env))) return galat(403, 'Halaman ini khusus mod.');
  const { results } = await env.DB.prepare(
    "SELECT jenis, target_id, COUNT(*) AS n, MIN(dibuat) AS pertama, GROUP_CONCAT(alasan, ' | ') AS alasan FROM laporan " +
    "WHERE status = 'baru' GROUP BY jenis, target_id ORDER BY n DESC, pertama ASC LIMIT 50"
  ).all();
  const isi = [];
  for (const l of results) {
    const o = { jenis: l.jenis, id: l.target_id, jumlah: l.n, pertama: l.pertama, alasan: [...new Set(String(l.alasan || '').split(' | '))] };
    if (l.jenis === 'foto') {
      const f = await env.DB.prepare('SELECT f.id, f.jenis, f.nick, f.caption, f.status, p.id AS pid, p.nama FROM foto f JOIN pengguna p ON p.id = f.pengguna_id WHERE f.id = ?1').bind(l.target_id).first();
      if (!f) continue;
      o.foto = { src: f.status === 'ditolak' ? null : '/img/' + f.id + '.' + f.jenis, nick: f.nick, caption: f.caption, status: f.status };
      o.pemilik = { id: f.pid, nama: f.nama };
    } else {
      const k = await env.DB.prepare('SELECT k.isi, k.status, k.alasan, k.foto_id, f.jenis, f.caption, p.id AS pid, p.nama FROM komentar k JOIN pengguna p ON p.id = k.pengguna_id JOIN foto f ON f.id = k.foto_id WHERE k.id = ?1').bind(l.target_id).first();
      if (!k) continue;
      o.komentar = { isi: k.isi, status: k.status, alasan: k.alasan, foto: { id: k.foto_id, src: '/img/' + k.foto_id + '.' + k.jenis, caption: k.caption } };
      o.pemilik = { id: k.pid, nama: k.nama };
    }
    isi.push(o);
  }
  return json({ jumlah: await jumlah(env), laporan: isi });
}

const OTOMATIS = 'Disembunyikan otomatis: banyak laporan';
export const ALASAN_OTOMATIS = OTOMATIS;

/** POST /api/mod/laporan  { jenis, id, aksi: 'tindak' | 'abaikan', alasan } */
export async function aksiLaporan(req, env) {
  if (!asalSah(req, env)) return galat(403, 'Permintaan ditolak.');
  const m = await modDari(req, env);
  if (!m) return galat(403, 'Halaman ini khusus mod.');
  const b = await bacaJson(req);
  if (!b || !['foto', 'komentar'].includes(b.jenis) || !UUID.test(String(b.id || '')) || !['tindak', 'abaikan'].includes(b.aksi)) return galat(400, 'Permintaan tidak valid.');
  const tutup = env.DB.prepare("UPDATE laporan SET status = 'selesai' WHERE jenis = ?1 AND target_id = ?2 AND status = 'baru'").bind(b.jenis, b.id);

  if (b.aksi === 'abaikan') {
    const langkah = [tutup, catat(env, m, 'abaikan-laporan', { foto: b.jenis === 'foto' ? b.id : null, alasan: b.jenis === 'komentar' ? 'Komentar ' + b.id.slice(0, 8) : null })];
    // Komentar yang tadinya disembunyikan otomatis karena laporan: munculkan lagi
    if (b.jenis === 'komentar') langkah.push(env.DB.prepare("UPDATE komentar SET status = 'tampil', alasan = NULL, dicek_oleh = ?2, dicek_pada = ?3 WHERE id = ?1 AND status = 'disembunyikan' AND alasan = ?4").bind(b.id, m.id, sekarang(), OTOMATIS));
    await env.DB.batch(langkah);
    return json({ ok: true });
  }

  const alasan = rapikanTeks(b.alasan, 150);
  if (alasan.length < 3) return galat(400, 'Tulis alasannya.');
  if (b.jenis === 'foto') {
    const f = await env.DB.prepare('SELECT id, jenis, status, pengguna_id FROM foto WHERE id = ?1').bind(b.id).first();
    if (!f) return galat(404, 'Foto tidak ditemukan.');
    if (f.status === 'ditolak') { await tutup.run(); return json({ ok: true }); }
    if (!(await turunkanFoto(env, m, f, alasan))) return galat(409, 'Status foto sudah berubah. Muat ulang daftarnya.');
    return json({ ok: true });
  }
  const r = await sembunyikan(env, m, b.id, alasan);
  if (r) return r;
  await tutup.run();
  return json({ ok: true });
}

async function sembunyikan(env, m, id, alasan) {
  const k = await env.DB.prepare('SELECT id, pengguna_id, foto_id FROM komentar WHERE id = ?1').bind(id).first();
  if (!k) return galat(404, 'Komentar tidak ditemukan.');
  await env.DB.batch([
    env.DB.prepare("UPDATE komentar SET status = 'disembunyikan', dicek_oleh = ?2, dicek_pada = ?3, alasan = ?4 WHERE id = ?1").bind(id, m.id, sekarang(), alasan),
    env.DB.prepare("UPDATE laporan SET status = 'selesai' WHERE jenis = 'komentar' AND target_id = ?1 AND status = 'baru'").bind(id),
    catat(env, m, 'sembunyikan-komentar', { foto: k.foto_id, pengguna: k.pengguna_id, alasan })
  ]);
  return null;
}

/** POST /api/mod/komentar  { id, alasan } -> mod menyembunyikan komentar langsung (misalnya dari lightbox) */
export async function sembunyikanKomentar(req, env) {
  if (!asalSah(req, env)) return galat(403, 'Permintaan ditolak.');
  const m = await modDari(req, env);
  if (!m) return galat(403, 'Halaman ini khusus mod.');
  const b = await bacaJson(req);
  if (!b || !UUID.test(String(b.id || ''))) return galat(400, 'Permintaan tidak valid.');
  const alasan = rapikanTeks(b.alasan, 150);
  if (alasan.length < 3) return galat(400, 'Tulis alasannya.');
  return (await sembunyikan(env, m, b.id, alasan)) || json({ ok: true });
}

/* ---------- Nickname (Fase G4) ---------- */

/** GET /api/mod/nick -> semua nickname yang sudah dimiliki / dipesan */
export async function daftarNick(req, env) {
  if (!(await modDari(req, env))) return galat(403, 'Halaman ini khusus mod.');
  const { results } = await env.DB.prepare(
    'SELECT n.nick, n.tampil, n.dibuat, p.id AS pid, p.nama FROM nick n LEFT JOIN pengguna p ON p.id = n.pengguna_id ORDER BY n.tampil COLLATE NOCASE LIMIT 500'
  ).all();
  return json({ jumlah: await jumlah(env), nick: results.map(r => ({ nick: r.nick, tampil: r.tampil, dibuat: r.dibuat, pemilik: r.pid ? { id: r.pid, nama: r.nama } : null })) });
}

/** POST /api/mod/nick  { nick, aksi: 'lepas' } -> nickname bebas lagi, pemakai berikutnya jadi pemiliknya */
export async function aksiNick(req, env) {
  if (!asalSah(req, env)) return galat(403, 'Permintaan ditolak.');
  const m = await modDari(req, env);
  if (!m) return galat(403, 'Halaman ini khusus mod.');
  const b = await bacaJson(req);
  const n = String((b && b.nick) || '').toLowerCase();
  if (!b || b.aksi !== 'lepas' || !/^[a-z0-9_.* ]{3,24}$/.test(n)) return galat(400, 'Permintaan tidak valid.');
  const row = await env.DB.prepare('SELECT tampil, pengguna_id FROM nick WHERE nick = ?1').bind(n).first();
  if (!row) return galat(404, 'Nickname tidak ditemukan.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM nick WHERE nick = ?1').bind(n),
    catat(env, m, 'lepas-nick', { pengguna: row.pengguna_id, alasan: 'Nickname ' + row.tampil })
  ]);
  return json({ ok: true });
}

/* ---------- Notifikasi ke channel mod (webhook Discord) ---------- */
const WEBHOOK = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;
const JEDA_NOTIF = 600; // detik, per jenis notifikasi

export const pesanNotif = (n, situs) =>
  '📸 Ada foto baru di antrean galeri. Total menunggu dicek: **' + n + '**.\nCek di ' + situs + '/galeri/mod/';
export const pesanLaporan = (n, situs) =>
  '🚩 Ada laporan baru di galeri. Total konten yang dilaporkan: **' + n + '**.\nCek di ' + situs + '/galeri/mod/#laporan';

/**
 * Kirim notifikasi ke channel mod. jenis: 'foto' (upload baru) atau 'laporan'.
 * Diam-diam berhenti kalau webhook belum diisi, dimatikan, atau jenis yang sama baru saja dikirim.
 */
export async function kabariMod(env, kirim = fetch, jenis = 'foto') {
  const url = String(env.DISCORD_WEBHOOK_MOD || '').trim();
  if (env.NOTIF_MATI === '1' || !WEBHOOK.test(url)) return false;
  const t = sekarang(), kunci = jenis === 'laporan' ? 'notif_laporan' : 'notif_terakhir';
  const akhir = await env.DB.prepare('SELECT nilai FROM pengaturan WHERE kunci = ?1').bind(kunci).first();
  if (akhir && t - Number(akhir.nilai) < JEDA_NOTIF) return false;
  await env.DB.prepare('INSERT INTO pengaturan (kunci, nilai) VALUES (?1, ?2) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai')
    .bind(kunci, String(t)).run();
  const isi = jenis === 'laporan' ? pesanLaporan(await jumlahLaporan(env), env.SITUS) : pesanNotif(await jumlahMenunggu(env), env.SITUS);
  const r = await kirim(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Galeri ChaaTown', content: isi, allowed_mentions: { parse: [] } })
  });
  return r.ok;
}
