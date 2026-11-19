/* =====================================================================
   masuk.js - login pakai akun Discord (OAuth2) dan sesi

   - Yang diminta dari Discord hanya: identitas (username, avatar) dan
     keanggotaan di server ChaaTown (scope "identify guilds.members.read").
     Daftar server lain milik pengunjung TIDAK diminta.
   - Bukan member server ChaaTown -> tidak bisa masuk.
   - Token Discord langsung dicabut setelah dipakai; kita tidak menyimpannya.
   - Sesi: kunci acak di cookie HttpOnly. Database hanya menyimpan sidik
     (hash) kunci itu, jadi bocornya database tidak membocorkan sesi.
   ===================================================================== */
import { json, galat, sekarang, acak, sha256, bacaCookie, buatCookie, asalSah } from './alat.js';

const SESI = '__Host-sesi', STATE = '__Host-oauth';
const UMUR_SESI = 7 * 24 * 3600; // 7 hari
const DISCORD = 'https://discord.com/api/v10';

// Halaman tujuan setelah login: hanya path lokal sederhana (cegah dialihkan ke situs lain)
function balikKe(url) {
  const b = url.searchParams.get('balik');
  return b && /^\/[A-Za-z0-9/_-]{0,60}$/.test(b) && !b.startsWith('//') ? b : '/galeri/';
}

function alih(ke, cookies = []) {
  const h = new Headers({ Location: ke, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  for (const c of cookies) h.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers: h });
}
const hapusState = buatCookie(STATE, '', { umur: 0 });

/** GET /api/auth/masuk -> lempar ke halaman izin Discord */
export function masuk(req, env, ctx, url) {
  const balik = balikKe(url);
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return alih(balik + '?login=belum-siap');
  const state = acak(24);
  const q = new URLSearchParams({
    response_type: 'code', client_id: env.DISCORD_CLIENT_ID, scope: 'identify guilds.members.read',
    redirect_uri: env.SITUS + '/api/auth/callback', state, prompt: 'none'
  });
  return alih('https://discord.com/oauth2/authorize?' + q, [buatCookie(STATE, state + '~' + balik, { umur: 600 })]);
}

/** GET /api/auth/callback -> Discord mengembalikan pengunjung ke sini */
export async function callback(req, env, ctx, url) {
  let [state, balik] = (bacaCookie(req, STATE) || '').split('~');
  if (!balik || !/^\/[A-Za-z0-9/_-]{0,60}$/.test(balik) || balik.startsWith('//')) balik = '/galeri/';
  const hasil = s => alih(balik + '?login=' + s, [hapusState]);
  if (url.searchParams.get('error')) return hasil('batal');
  const code = url.searchParams.get('code');
  if (!state || !code || url.searchParams.get('state') !== state) return hasil('gagal');

  const basic = 'Basic ' + btoa(env.DISCORD_CLIENT_ID + ':' + env.DISCORD_CLIENT_SECRET);
  const tr = await fetch(DISCORD + '/oauth2/token', {
    method: 'POST', headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: env.SITUS + '/api/auth/callback' })
  });
  if (!tr.ok) return hasil('gagal');
  const { access_token: token } = await tr.json();
  const auth = { Authorization: 'Bearer ' + token };
  try {
    const ur = await fetch(DISCORD + '/users/@me', { headers: auth });
    if (!ur.ok) return hasil('gagal');
    const user = await ur.json();
    const mr = await fetch(DISCORD + '/users/@me/guilds/' + env.GUILD_ID + '/member', { headers: auth });
    if (mr.status === 404) return hasil('bukan-member');
    if (!mr.ok) return hasil('gagal');
    const member = await mr.json();

    const modRoles = String(env.MOD_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const mod = (member.roles || []).some(r => modRoles.includes(r));
    const nama = String(member.nick || user.global_name || user.username || 'Pemain').slice(0, 40);
    return await buatSesi(env, ctx, { id: String(user.id), nama, avatar: user.avatar || null, mod }, balik, [hapusState]);
  } finally {
    // Token Discord tidak dibutuhkan lagi: cabut supaya tidak bisa dipakai siapa pun
    ctx.waitUntil(fetch(DISCORD + '/oauth2/token/revoke', {
      method: 'POST', headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, token_type_hint: 'access_token' })
    }).catch(() => {}));
  }
}

async function buatSesi(env, ctx, p, balik, cookies = []) {
  const t = sekarang();
  const row = await env.DB.prepare(
    'INSERT INTO pengguna (id, nama, avatar, dibuat) VALUES (?1, ?2, ?3, ?4) ' +
    'ON CONFLICT(id) DO UPDATE SET nama = excluded.nama, avatar = excluded.avatar RETURNING diblokir'
  ).bind(p.id, p.nama, p.avatar, t).first();
  if (row && row.diblokir) return alih(balik + '?login=diblokir', cookies);
  const kunci = acak(32);
  await env.DB.prepare('INSERT INTO sesi (id, pengguna_id, mod, kedaluwarsa) VALUES (?1, ?2, ?3, ?4)')
    .bind(await sha256(kunci), p.id, p.mod ? 1 : 0, t + UMUR_SESI).run();
  ctx.waitUntil(env.DB.prepare('DELETE FROM sesi WHERE kedaluwarsa < ?1').bind(t).run()); // bersihkan sesi lama
  return alih(balik + '?login=ok', [...cookies, buatCookie(SESI, kunci, { umur: UMUR_SESI })]);
}

/** Baca sesi dari cookie. Hasil: { id, nama, avatar, mod, diblokir, kunciHash } atau null */
export async function sesiDari(req, env) {
  const kunci = bacaCookie(req, SESI);
  if (!kunci || !/^[A-Za-z0-9_-]{40,64}$/.test(kunci)) return null;
  const h = await sha256(kunci);
  const r = await env.DB.prepare(
    'SELECT s.mod, s.kedaluwarsa, p.id, p.nama, p.avatar, p.diblokir FROM sesi s JOIN pengguna p ON p.id = s.pengguna_id WHERE s.id = ?1'
  ).bind(h).first();
  if (!r || r.kedaluwarsa < sekarang()) return null;
  return { id: r.id, nama: r.nama, avatar: r.avatar, mod: !!r.mod, diblokir: !!r.diblokir, kunciHash: h };
}

/** POST /api/auth/keluar */
export async function keluar(req, env) {
  if (!asalSah(req, env)) return galat(403, 'Permintaan ditolak.');
  const s = await sesiDari(req, env);
  if (s) await env.DB.prepare('DELETE FROM sesi WHERE id = ?1').bind(s.kunciHash).run();
  return json({ ok: true }, 200, { 'Set-Cookie': buatCookie(SESI, '', { umur: 0 }) });
}

/** Login uji: HANYA kalau DEV_LOGIN=1 (diisi di _api/.dev.vars) dan dibuka dari komputer sendiri. */
export function devAktif(env, url) {
  return env.DEV_LOGIN === '1' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}
export async function devMasuk(req, env, ctx, url) {
  if (!devAktif(env, url)) return galat(404, 'Alamat API tidak dikenal.');
  const id = (url.searchParams.get('id') || '100000000000000001').replace(/\D/g, '').slice(0, 20) || '100000000000000001';
  const nama = (url.searchParams.get('nama') || 'Pemain Uji').slice(0, 40);
  return buatSesi(env, ctx, { id, nama, avatar: null, mod: url.searchParams.get('mod') === '1' }, balikKe(url));
}
