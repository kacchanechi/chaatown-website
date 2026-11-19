/* =====================================================================
   foto.js - daftar foto, upload, dan penyajian gambar
   ===================================================================== */
import { json, galat, sekarang, asalSah, rapikanTeks, cekBatas, ARSIP, srcFoto } from './alat.js';
import { periksaGambar, Tolak } from './berkas.js';
import { sesiDari, devAktif } from './masuk.js';
import { kabariMod, jumlahMenunggu, jumlahLaporan } from './mod.js';

const MAKS_NICK_PER_AKUN = 3;

const NICK = /^[A-Za-z0-9_.* ]{3,24}$/; // nickname Minecraft (Java & Bedrock), 3-24 karakter
const JENIS = { webp: 'image/webp', jpg: 'image/jpeg' };
const angka = (v, cadangan) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : cadangan; };

async function kuota(env, idPengguna) {
  const r = await env.DB.prepare(
    "SELECT SUM(dibuat > ?2) AS hariIni, SUM(status = 'menunggu') AS antrean FROM foto WHERE pengguna_id = ?1"
  ).bind(idPengguna, sekarang() - 86400).first();
  return {
    hariIni: r.hariIni || 0, batasHarian: angka(env.BATAS_UPLOAD_HARIAN, 5),
    antrean: r.antrean || 0, batasAntrean: angka(env.BATAS_ANTREAN, 10)
  };
}

/** GET /api/saya -> status login + kuota upload */
export async function saya(req, env, ctx, url) {
  const umum = { turnstile: env.TURNSTILE_SITEKEY || null, ukuranMaks: angka(env.UKURAN_MAKS, 5242880), discordSiap: !!env.DISCORD_CLIENT_ID, loginUji: devAktif(env, url) };
  const s = await sesiDari(req, env);
  if (!s) return json({ masuk: false, ...umum });
  const hasil = { masuk: true, ...umum, id: s.id, nama: s.nama, avatar: s.avatar, mod: s.mod, diblokir: s.diblokir, kuota: await kuota(env, s.id) };
  if (s.mod) { hasil.antreanMod = await jumlahMenunggu(env); hasil.laporanMod = await jumlahLaporan(env); }
  const { results: nk } = await env.DB.prepare('SELECT tampil FROM nick WHERE pengguna_id = ?1 ORDER BY dibuat').bind(s.id).all();
  hasil.nick = nk.map(r => r.tampil); // nickname milik akun ini
  return json(hasil);
}

/** GET /api/foto -> foto yang sudah disetujui mod (terbaru dulu) */
export async function daftar(req, env, ctx, url) {
  const sebelum = angka(url.searchParams.get('sebelum'), 2e9);
  const s = await sesiDari(req, env);
  const { results } = await env.DB.prepare(
    "SELECT f.id, f.jenis, f.nick, f.caption, f.lebar, f.tinggi, f.dibuat, f.berkas, p.nama, p.avatar, p.id AS pid, " +
    "(SELECT COUNT(*) FROM suka x WHERE x.foto_id = f.id) AS suka, " +
    "(SELECT COUNT(*) FROM komentar k WHERE k.foto_id = f.id AND k.status = 'tampil') AS komentar, " +
    "EXISTS (SELECT 1 FROM suka x WHERE x.foto_id = f.id AND x.pengguna_id = ?2) AS disukai " +
    "FROM foto f JOIN pengguna p ON p.id = f.pengguna_id WHERE f.status = 'tayang' AND f.dibuat < ?1 ORDER BY f.dibuat DESC LIMIT 60"
  ).bind(sebelum, s ? s.id : '').all();
  // Semua foto lama yang sudah tercatat (apa pun statusnya): halaman memakai ini supaya
  // daftar foto lama bawaan halaman tidak ditampilkan dobel, dan yang diturunkan mod tidak muncul lagi.
  const { results: arsip } = await env.DB.prepare('SELECT berkas FROM foto WHERE berkas IS NOT NULL').all();
  return json({
    foto: results.map(r => ({
      id: r.id, src: srcFoto(r), nick: r.nick, caption: r.caption, lebar: r.lebar, tinggi: r.tinggi, dibuat: r.dibuat,
      suka: r.suka, komentar: r.komentar, disukai: !!r.disukai, arsip: !!r.berkas,
      pemilik: r.pid === ARSIP ? null : { id: r.pid, nama: r.nama, avatar: r.avatar }
    })),
    berkasArsip: arsip.map(a => a.berkas)
  });
}

/** GET /api/foto/saya -> semua foto milik yang sedang login, termasuk yang menunggu/ditolak */
export async function punyaSaya(req, env) {
  const s = await sesiDari(req, env);
  if (!s) return galat(401, 'Masuk dengan Discord dulu.');
  const { results } = await env.DB.prepare(
    'SELECT id, jenis, nick, caption, status, alasan, dibuat FROM foto WHERE pengguna_id = ?1 ORDER BY dibuat DESC LIMIT 50'
  ).bind(s.id).all();
  // Foto yang ditolak sudah dihapus filenya, jadi tidak punya gambar lagi
  return json({ foto: results.map(r => ({ ...r, src: r.status === 'ditolak' ? null : '/img/' + r.id + '.' + r.jenis })) });
}

const TURNSTILE_UJI = '1x0000000000000000000000000000000AA'; // kunci uji resmi Cloudflare (selalu lolos)
async function cekTurnstile(token, req, env) {
  if (!env.TURNSTILE_SECRET || typeof token !== 'string' || !token || token.length > 2048) return false; // tanpa kunci rahasia: selalu tolak
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: req.headers.get('CF-Connecting-IP') || '' })
    });
    const h = await r.json();
    if (h.success !== true) return false;
    // Token harus dibuat di situs kita sendiri (kecuali saat memakai kunci uji, yang selalu melaporkan situs contoh)
    return env.TURNSTILE_SECRET === TURNSTILE_UJI || h.hostname === new URL(env.SITUS).hostname;
  } catch { return false; }
}

/** POST /api/foto -> upload foto baru (masuk antrean, belum tayang) */
export async function upload(req, env, ctx) {
  // Urutan: pemeriksaan murah dulu, pemeriksaan berat (isi gambar) paling akhir
  if (!asalSah(req, env)) return galat(403, 'Permintaan ditolak.');
  const s = await sesiDari(req, env);
  if (!s) return galat(401, 'Masuk dengan Discord dulu.');
  if (s.diblokir) return galat(403, 'Akunmu tidak bisa upload ke galeri.');

  const maks = angka(env.UKURAN_MAKS, 5242880);
  const panjang = Number(req.headers.get('Content-Length') || 0);
  if (!panjang) return galat(411, 'Ukuran kiriman tidak diketahui.');
  if (panjang > maks + 65536) return galat(413, 'Foto terlalu besar (maksimal ' + Math.round(maks / 1048576) + ' MB).');
  if (!(req.headers.get('Content-Type') || '').startsWith('multipart/form-data')) return galat(415, 'Format kiriman salah.');

  let form;
  try { form = await req.formData(); } catch { return galat(400, 'Kiriman rusak.'); }
  const file = form.get('foto');
  if (!(file instanceof File) || !file.size) return galat(400, 'Pilih foto dulu.');
  if (file.size > maks) return galat(413, 'Foto terlalu besar (maksimal ' + Math.round(maks / 1048576) + ' MB).');
  let nick = rapikanTeks(form.get('nick'), 40);
  if (!NICK.test(nick)) return galat(400, 'Isi nickname Minecraft-mu (3 sampai 24 karakter: huruf, angka, _).');
  // Kepemilikan nickname: nick pertama dipakai akun siapa, jadi milik akun itu (cegah menyamar jadi pemain lain)
  const punya = await env.DB.prepare('SELECT tampil, pengguna_id FROM nick WHERE nick = ?1').bind(nick.toLowerCase()).first();
  if (punya) {
    if (punya.pengguna_id !== s.id) return galat(409, punya.pengguna_id
      ? 'Nickname ini sudah dipakai akun Discord lain. Kalau ini benar nickname-mu, hubungi mod.'
      : 'Nickname ini dipesan untuk pemilik foto lama di galeri. Kalau ini nickname-mu, hubungi mod supaya bisa dipakai.');
    nick = punya.tampil; // samakan penulisan, misalnya "gikx" -> "Gikx"
  } else {
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM nick WHERE pengguna_id = ?1').bind(s.id).first()).n;
    if (n >= MAKS_NICK_PER_AKUN) return galat(400, 'Satu akun Discord maksimal punya ' + MAKS_NICK_PER_AKUN + ' nickname. Pakai salah satu nickname-mu yang sudah ada.');
  }
  const caption = rapikanTeks(form.get('caption'), 150);

  if (!(await cekTurnstile(form.get('cf-turnstile-response'), req, env))) return galat(400, 'Verifikasi anti-bot gagal. Coba lagi.');

  const k = await kuota(env, s.id);
  if (k.hariIni >= k.batasHarian) return galat(429, 'Batas upload hari ini sudah habis (' + k.batasHarian + ' foto per 24 jam).');
  if (k.antrean >= k.batasAntrean) return galat(429, 'Masih ada ' + k.antrean + ' fotomu yang menunggu dicek mod. Tunggu dulu ya.');
  // Penghitung atomik: walau banyak kiriman datang BERSAMAAN, maksimal 5 lolos per 10 menit
  if (!(await cekBatas(env, 'upload:' + s.id, 5, 600))) return galat(429, 'Terlalu banyak upload dalam waktu singkat. Tunggu sekitar 10 menit, ya.');

  let g;
  try { g = periksaGambar(new Uint8Array(await file.arrayBuffer())); }
  catch (e) { if (e instanceof Tolak) return galat(400, e.message); throw e; }

  const id = crypto.randomUUID(), t = sekarang();
  await env.FOTO.put('foto/' + id + '.' + g.jenis, g.isi, { httpMetadata: { contentType: JENIS[g.jenis] } });
  const simpan = [env.DB.prepare(
    "INSERT INTO foto (id, pengguna_id, nick, caption, jenis, status, lebar, tinggi, ukuran, dibuat) VALUES (?1, ?2, ?3, ?4, ?5, 'menunggu', ?6, ?7, ?8, ?9)"
  ).bind(id, s.id, nick, caption, g.jenis, g.lebar, g.tinggi, g.isi.length, t)];
  if (!punya) simpan.push(env.DB.prepare('INSERT OR IGNORE INTO nick (nick, tampil, pengguna_id, dibuat) VALUES (?1, ?2, ?3, ?4)').bind(nick.toLowerCase(), nick, s.id, t));
  await env.DB.batch(simpan);
  ctx.waitUntil(kabariMod(env).catch(e => console.error('notifikasi mod gagal:', e && e.message))); // tidak menunda balasan ke pengupload
  return json({ id, status: 'menunggu' }, 201);
}

/** GET /img/<id>.<webp|jpg> -> file gambar. Yang belum tayang hanya untuk pemilik & mod. */
export async function gambar(req, env, nama) {
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(webp|jpg)$/.exec(nama);
  if (!m) return galat(404, 'Foto tidak ditemukan.');
  const f = await env.DB.prepare('SELECT pengguna_id, status, jenis FROM foto WHERE id = ?1').bind(m[1]).first();
  if (!f || f.jenis !== m[2]) return galat(404, 'Foto tidak ditemukan.');
  const publik = f.status === 'tayang';
  if (!publik) {
    const s = await sesiDari(req, env);
    if (!s || (s.id !== f.pengguna_id && !s.mod)) return galat(404, 'Foto tidak ditemukan.');
  }
  const obj = await env.FOTO.get('foto/' + nama);
  if (!obj) return galat(404, 'Foto tidak ditemukan.');
  return new Response(obj.body, {
    headers: {
      'Content-Type': JENIS[m[2]],
      'X-Content-Type-Options': 'nosniff',                         // browser dilarang menebak jenis file
      'Content-Security-Policy': "default-src 'none'; sandbox",   // kalaupun dibuka langsung, tidak ada yang bisa dijalankan
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Disposition': 'inline; filename="chaatown-' + m[1].slice(0, 8) + '.' + m[2] + '"',
      'Cache-Control': publik ? 'public, max-age=3600' : 'private, no-store'
    }
  });
}
