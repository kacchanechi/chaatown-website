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
import { json, galat, sekarang, asalSah, rapikanTeks } from './alat.js';
import { sesiDari } from './masuk.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ID_DISCORD = /^\d{5,20}$/;

async function modDari(req, env) {
  const s = await sesiDari(req, env);
  return s && s.mod && !s.diblokir ? s : null;
}
async function bacaJson(req) {
  if (!(req.headers.get('Content-Type') || '').startsWith('application/json')) return null;
  const t = await req.text();
  if (t.length > 4096) return null;
  try { const j = JSON.parse(t); return j && typeof j === 'object' ? j : null; } catch { return null; }
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
  return o;
}
export const jumlahMenunggu = async env => (await env.DB.prepare("SELECT COUNT(*) AS n FROM foto WHERE status = 'menunggu'").first()).n;

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
    const r = await env.DB.prepare("UPDATE foto SET status = 'ditolak', dicek_oleh = ?2, dicek_pada = ?3, alasan = ?4 WHERE id = ?1 AND status = ?5")
      .bind(f.id, m.id, t, alasan, f.status).run();
    if (!r.meta.changes) return galat(409, 'Status foto sudah berubah. Muat ulang daftarnya.');
    await env.FOTO.delete('foto/' + f.id + '.' + f.jenis); // konten yang ditolak tidak disimpan
    await catat(env, m, f.status === 'tayang' ? 'turunkan' : 'tolak', { foto: f.id, pengguna: f.pengguna_id, alasan }).run();
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

/* ---------- Notifikasi ke channel mod (webhook Discord) ---------- */
const WEBHOOK = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;
const JEDA_NOTIF = 600; // detik

export const pesanNotif = (n, situs) =>
  '📸 Ada foto baru di antrean galeri. Total menunggu dicek: **' + n + '**.\nCek di ' + situs + '/galeri/mod/';

/** Dipanggil setelah upload. Diam-diam berhenti kalau webhook belum diisi, dimatikan, atau baru saja mengirim. */
export async function kabariMod(env, kirim = fetch) {
  const url = String(env.DISCORD_WEBHOOK_MOD || '').trim();
  if (env.NOTIF_MATI === '1' || !WEBHOOK.test(url)) return false;
  const t = sekarang();
  const akhir = await env.DB.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'notif_terakhir'").first();
  if (akhir && t - Number(akhir.nilai) < JEDA_NOTIF) return false;
  await env.DB.prepare("INSERT INTO pengaturan (kunci, nilai) VALUES ('notif_terakhir', ?1) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai")
    .bind(String(t)).run();
  const r = await kirim(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Galeri ChaaTown', content: pesanNotif(await jumlahMenunggu(env), env.SITUS), allowed_mentions: { parse: [] } })
  });
  return r.ok;
}
