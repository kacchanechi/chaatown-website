/* =====================================================================
   Uji dapur galeri. Jalankan dari folder _api, saat "npm.cmd run dev" sedang
   jalan di terminal lain:   npm.cmd run uji
   Butuh internet (verifikasi anti-bot memakai kunci uji resmi Cloudflare).
   Aman diulang: setiap putaran memakai akun uji baru.
   CATATAN: uji ini membuat akun & foto uji di database lokal, dan memakai
   login uji (DEV_LOGIN=1). Kalau webhook mod diisi di .dev.vars, upload uji
   bisa memicu notifikasi ke channel mod (paling sering 1x per 10 menit).
   Server lain: set UJI_URL, misalnya UJI_URL=http://localhost:8788
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { periksaGambar, Tolak } from '../src/berkas.js';
import { kabariMod, pesanNotif, pesanLaporan } from '../src/mod.js';
import { kataKasar } from '../src/kata.js';

const DIR = path.dirname(fileURLToPath(import.meta.url)), API = path.join(DIR, '..'), ROOT = path.join(API, '..');
const B = process.env.UJI_URL || 'http://localhost:8787', ORIGIN = { Origin: B };
let lolos = 0, gagal = 0;
const cek = (nama, ok, info = '') => { ok ? lolos++ : gagal++; console.log((ok ? '  PASS ' : '  FAIL ') + nama + (ok ? '' : '  -> ' + info)); };
const baca = p => new Uint8Array(readFileSync(path.join(ROOT, p)));
const teks = b => Buffer.from(b).toString('latin1');
const gabung = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const ascii = s => new Uint8Array(Buffer.from(s, 'latin1'));
const le32 = n => new Uint8Array([n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255]);
function ditolak(fn, pola) { try { fn(); return false; } catch (e) { return e instanceof Tolak && (!pola || pola.test(e.message)); } }

// Ubah WebP sederhana jadi bentuk VP8X + chunk tambahan (untuk menyusun file "nakal")
function webpDengan(asli, tambahan, bendera = 0) {
  const img = asli.subarray(12, 12 + 8 + ((asli[16] | asli[17] << 8 | asli[18] << 16 | asli[19] << 24) >>> 0));
  const g = periksaGambar(asli), w = g.lebar - 1, h = g.tinggi - 1;
  const vp8x = gabung(ascii('VP8X'), le32(10), new Uint8Array([bendera, 0, 0, 0, w & 255, w >> 8 & 255, w >> 16 & 255, h & 255, h >> 8 & 255, h >> 16 & 255]));
  const isi = gabung(ascii('WEBP'), vp8x, img, ...tambahan);
  return gabung(ascii('RIFF'), le32(isi.length), isi);
}
const chunk = (id, data) => gabung(ascii(id), le32(data.length), data, data.length & 1 ? new Uint8Array(1) : new Uint8Array(0));

/* ---------- 1. Pemeriksa file ---------- */
console.log('== Pemeriksa file (berkas.js)');
const W = baca('galeri/lodge-salju.webp'), J = baca('assets/img/og-image.jpg');
const gw = periksaGambar(W), gj = periksaGambar(J);
cek('WebP asli diterima', gw.jenis === 'webp' && gw.lebar > 0, JSON.stringify({ ...gw, isi: gw.isi.length }));
cek('JPG asli diterima', gj.jenis === 'jpg' && gj.lebar === 1200 && gj.tinggi === 630, JSON.stringify({ ...gj, isi: gj.isi.length }));

const exifGps = chunk('EXIF', ascii('Exif\0\0GPSLatitude=-6.2;GPSLongitude=106.8'));
const wExif = webpDengan(W, [exifGps, chunk('XMP ', ascii('<x:xmpmeta>rahasia</x:xmpmeta>'))], 0x08 | 0x04);
const hExif = periksaGambar(wExif);
cek('WebP + EXIF/XMP: metadata dibuang', !teks(hExif.isi).includes('GPS') && !teks(hExif.isi).includes('rahasia') && (hExif.isi[20] & 0x0C) === 0);
cek('WebP hasil bersih tetap valid', periksaGambar(hExif.isi).lebar === gw.lebar);
const hTempel = periksaGambar(gabung(W, ascii('<script>alert(1)</script>')));
cek('WebP + data tempelan <script>: dibuang', !teks(hTempel.isi).includes('<script>') && hTempel.isi.length === W.length);
cek('WebP dengan bagian asing ditolak', ditolak(() => periksaGambar(webpDengan(W, [chunk('EVIL', ascii('<html>'))])), /tidak diizinkan/));
cek('WebP animasi ditolak', ditolak(() => periksaGambar(webpDengan(W, [], 0x02)), /animasi/));
cek('WebP terpotong ditolak', ditolak(() => periksaGambar(W.subarray(0, W.length >> 1)), /rusak/));
cek('WebP dengan ukuran di header tidak cocok ditolak', ditolak(() => periksaGambar(webpDengan(W, [], 0).map((x, i, a) => i === 24 ? 0x7F : x))));

const app1 = gabung(new Uint8Array([0xFF, 0xE1]), new Uint8Array([0, 40]), ascii('Exif\0\0GPSLatitude=-6.2;Long=106.8.....'));
const jExif = gabung(J.subarray(0, 2), app1, J.subarray(2));
const hj = periksaGambar(jExif);
cek('JPG + EXIF/GPS: metadata dibuang', !teks(hj.isi).includes('GPS'));
cek('JPG hasil bersih tetap valid', periksaGambar(hj.isi).lebar === 1200);
const hjT = periksaGambar(gabung(J, ascii('<html><script>alert(1)</script></html>')));
cek('JPG + HTML tempelan: dibuang', !teks(hjT.isi).includes('<script>'));
cek('JPG terpotong ditolak', ditolak(() => periksaGambar(J.subarray(0, 4000)), /rusak/));

cek('PNG mentah ditolak (harus diubah browser dulu)', ditolak(() => periksaGambar(baca('assets/img/apple-touch-icon.png')), /Format tidak didukung/));
cek('SVG ditolak', ditolak(() => periksaGambar(ascii('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="99" height="99"/></svg>')), /Format/));
cek('GIF ditolak', ditolak(() => periksaGambar(gabung(ascii('GIF89a'), new Uint8Array(40))), /Format/));
cek('HTML berkedok .jpg ditolak', ditolak(() => periksaGambar(ascii('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>')), /Format/));

console.log('== Filter kata kasar (kata.js)');
const KASAR = ['dasar kontol', 'K0NT0L lu', 'k.o.n.t.o.l', 'k o n t o l', 'kontolll', 'b4ngs4t', 'fuuuck this', 'FUCK', 'anjir goblok', 'Bajingan!', 'what the sh1t', 'dasar asu', 'faggot', 'sh!t', 'tolol.'];
const WAJAR = ['Rumahku di pantai', 'cook beef dulu', 'Anjing peliharaanku lucu', 'babi di farm', 'bangun tidur', 'jam 10 malam', 'assalamualaikum', 'Builder_0 keren banget',
  'coklat', 'pencoleng', 'peternakan', 'kokok ayam', 'tolong bantu', 'dickens novel', 'sate ayam', 'gg wp', 'cokelat panas', 'Keren!!!', 'Wah 100% mantap!', 'a.k.u suka'];
const lolosKasar = KASAR.filter(t => !kataKasar(t)), salahTolak = WAJAR.filter(t => kataKasar(t));
cek('Semua ' + KASAR.length + ' contoh kata kasar (termasuk samaran) ditolak', !lolosKasar.length, lolosKasar.join(' | '));
cek('Semua ' + WAJAR.length + ' kalimat wajar lolos (pantai, cook, anjing, babi, ...)', !salahTolak.length, salahTolak.join(' | '));

/* ---------- 2. Dapur galeri (server lokal) ---------- */
console.log('== Dapur galeri (' + B + ')');
const idUji = String(Date.now()) + String(Math.floor(Math.random() * 1e4)).padStart(4, '0');
const NICK_UJI = 'Uji' + idUji.slice(-8); // unik tiap putaran: nickname sekarang punya pemilik
async function login(id, nama) {
  const r = await fetch(B + '/api/auth/dev?id=' + id + '&nama=' + encodeURIComponent(nama), { redirect: 'manual' });
  const sc = r.headers.get('set-cookie') || '';
  return { r, sc, cookie: (sc.match(/__Host-sesi=[^;]+/) || [''])[0] };
}
function kirim(cookie, { file = W, nama = 'foto.webp', nick = NICK_UJI, caption = 'Uji', ts = 'XXXX.DUMMY.TOKEN.XXXX', origin = B } = {}) {
  const fd = new FormData();
  if (file) fd.append('foto', new Blob([file]), nama);
  fd.append('nick', nick); fd.append('caption', caption);
  if (ts) fd.append('cf-turnstile-response', ts);
  const h = { Cookie: cookie }; if (origin) h.Origin = origin;
  return fetch(B + '/api/foto', { method: 'POST', body: fd, headers: h });
}
const j = r => r.json();

try { await fetch(B + '/api/saya'); } catch { console.log('  Server belum jalan. Jalankan "npm run dev" di terminal lain dulu.'); process.exit(2); }

cek('Belum login: /api/saya masuk=false', (await j(await fetch(B + '/api/saya'))).masuk === false);
cek('Belum login: upload ditolak (401)', (await kirim('')).status === 401);

const a = await login(idUji, 'Pemain Uji');
cek('Login uji: dialihkan ke galeri', a.r.status === 302 && a.r.headers.get('location') === '/galeri/?login=ok', a.r.headers.get('location'));
cek('Cookie sesi: HttpOnly, Secure, SameSite=Lax', /HttpOnly/.test(a.sc) && /Secure/.test(a.sc) && /SameSite=Lax/.test(a.sc), a.sc);
const sy = await j(await fetch(B + '/api/saya', { headers: { Cookie: a.cookie } }));
cek('Sudah login: nama & kuota', sy.masuk && sy.nama === 'Pemain Uji' && sy.kuota.hariIni === 0, JSON.stringify(sy));

cek('Upload tanpa Origin ditolak (403, anti-CSRF)', (await kirim(a.cookie, { origin: null })).status === 403);
cek('Upload dari situs lain ditolak (403)', (await kirim(a.cookie, { origin: 'https://situs-jahat.example' })).status === 403);
cek('Upload tanpa verifikasi anti-bot ditolak', (await kirim(a.cookie, { ts: null })).status === 400);
cek('Upload tanpa file ditolak', (await kirim(a.cookie, { file: null })).status === 400);
let r = await kirim(a.cookie, { nick: '<b>x</b>' });
cek('Nickname aneh ditolak', r.status === 400, r.status);
r = await kirim(a.cookie, { file: baca('assets/img/apple-touch-icon.png'), nama: 'foto.webp' });
cek('PNG berkedok .webp ditolak', r.status === 400 && /Format/.test((await j(r)).galat));
r = await kirim(a.cookie, { file: ascii('<svg onload=alert(1)>'), nama: 'foto.jpg' });
cek('SVG berkedok .jpg ditolak', r.status === 400);
r = await kirim(a.cookie, { file: new Uint8Array(6 * 1048576) });
cek('File > 5 MB ditolak (413)', r.status === 413, r.status);

r = await kirim(a.cookie, { file: wExif, caption: 'Halo <script>alert(1)</script> ‮terbalik\u0007' });
const up = await j(r);
cek('Upload WebP (+EXIF) diterima -> antrean', r.status === 201 && up.status === 'menunggu', r.status + ' ' + JSON.stringify(up));
const saya2 = await j(await fetch(B + '/api/foto/saya', { headers: { Cookie: a.cookie } }));
const f1 = saya2.foto.find(f => f.id === up.id) || {};
cek('Caption: <script> disimpan sebagai teks biasa, karakter pembalik & kontrol dibuang', f1.caption === 'Halo <script>alert(1)</script> terbalik', JSON.stringify(f1.caption));
cek('Foto menunggu tidak muncul di galeri publik', !(await j(await fetch(B + '/api/foto'))).foto.some(f => f.id === up.id));

const img = B + '/img/' + up.id + '.webp';
cek('Gambar menunggu: orang lain tidak bisa lihat (404)', (await fetch(img)).status === 404);
const b2 = await login(idUji + '9', 'Pemain Lain');
cek('Gambar menunggu: akun lain juga 404', (await fetch(img, { headers: { Cookie: b2.cookie } })).status === 404);
const ri = await fetch(img, { headers: { Cookie: a.cookie } });
const isi = new Uint8Array(await ri.arrayBuffer());
cek('Gambar menunggu: pemilik bisa lihat', ri.status === 200 && ri.headers.get('content-type') === 'image/webp');
cek('Header gambar: nosniff + CSP sandbox + tidak di-cache', ri.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(ri.headers.get('content-security-policy')) && /no-store/.test(ri.headers.get('cache-control')));
cek('File tersimpan sudah bersih dari GPS', !teks(isi).includes('GPS') && !teks(isi).includes('rahasia'));
cek('Alamat gambar ngasal -> 404', (await fetch(B + '/img/../_api/.dev.vars')).status === 404 && (await fetch(B + '/img/abc.webp')).status === 404);

r = await kirim(a.cookie, { file: jExif, nama: 'foto.jpg' });
cek('Upload JPG diterima', r.status === 201, r.status);
for (let i = 0; i < 3; i++) await kirim(a.cookie);
r = await kirim(a.cookie);
cek('Upload ke-6 dalam 24 jam ditolak (429)', r.status === 429 && /Batas upload/.test((await j(r)).galat), r.status);

/* ---------- 3. Moderasi (Fase G3) ---------- */
console.log('== Moderasi');
const postJson = (u, cookie, data, origin = B) => fetch(B + u, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(data) });
cek('Belum login: daftar antrean ditolak (403)', (await fetch(B + '/api/mod/foto')).status === 403);
cek('Bukan mod: daftar antrean ditolak (403)', (await fetch(B + '/api/mod/foto', { headers: { Cookie: a.cookie } })).status === 403);
cek('Bukan mod: tidak bisa menyetujui (403)', (await postJson('/api/mod/foto', a.cookie, { id: up.id, aksi: 'setujui' })).status === 403);
const rm = await fetch(B + '/api/auth/dev?id=' + idUji + '5&nama=' + encodeURIComponent('Mod Uji') + '&mod=1', { redirect: 'manual' });
const m = { sc: rm.headers.get('set-cookie') || '' }; m.cookie = (m.sc.match(/__Host-sesi=[^;]+/) || [''])[0];
cek('Sesi mod cuma 12 jam', /Max-Age=43200/.test(m.sc), m.sc);
const sm = await j(await fetch(B + '/api/saya', { headers: { Cookie: m.cookie } }));
cek('Mod: /api/saya memberi tahu jumlah antrean', sm.mod === true && sm.antreanMod >= 5, JSON.stringify(sm));
const antre = await j(await fetch(B + '/api/mod/foto?status=menunggu', { headers: { Cookie: m.cookie } }));
const kartuUp = antre.foto.find(f => f.id === up.id);
cek('Mod: foto muncul di antrean + data pengupload', !!kartuUp && kartuUp.pengguna.nama === 'Pemain Uji' && kartuUp.nick === NICK_UJI && antre.jumlah.menunggu >= 5);
cek('Mod: antrean urut dari yang paling lama', antre.foto.every((f, i, x) => !i || x[i - 1].dibuat <= f.dibuat));
cek('Mod: bisa melihat gambar yang belum tayang', (await fetch(img, { headers: { Cookie: m.cookie } })).status === 200);
cek('Status tidak dikenal ditolak', (await fetch(B + '/api/mod/foto?status=x', { headers: { Cookie: m.cookie } })).status === 400);
cek('Setujui tanpa Origin ditolak (anti-CSRF)', (await postJson('/api/mod/foto', m.cookie, { id: up.id, aksi: 'setujui' }, null)).status === 403);
cek('Kiriman bukan JSON ditolak', (await fetch(B + '/api/mod/foto', { method: 'POST', headers: { Cookie: m.cookie, Origin: B, 'Content-Type': 'text/plain' }, body: 'id=' + up.id })).status === 400);
cek('ID foto ngasal ditolak', (await postJson('/api/mod/foto', m.cookie, { id: "' OR 1=1 --", aksi: 'setujui' })).status === 400);
r = await postJson('/api/mod/foto', m.cookie, { id: up.id, aksi: 'setujui' });
cek('Mod menyetujui foto', r.status === 200, r.status);
cek('Setujui dua kali -> 409 (sudah dicek)', (await postJson('/api/mod/foto', m.cookie, { id: up.id, aksi: 'setujui' })).status === 409);
const pub = await j(await fetch(B + '/api/foto'));
const fp = pub.foto.find(f => f.id === up.id);
cek('Setelah disetujui: muncul di galeri publik', !!fp && fp.nick === NICK_UJI && fp.pemilik.nama === 'Pemain Uji');
const rp = await fetch(img);
cek('Setelah disetujui: gambar bisa dibuka publik & boleh di-cache', rp.status === 200 && /public/.test(rp.headers.get('cache-control')));

cek('Tolak tanpa alasan ditolak', (await postJson('/api/mod/foto', m.cookie, { id: up.id, aksi: 'tolak', alasan: ' ' })).status === 400);
r = await postJson('/api/mod/foto', m.cookie, { id: up.id, aksi: 'tolak', alasan: 'Uji turunkan <b>foto</b>' });
cek('Mod menurunkan foto yang sudah tayang', r.status === 200, r.status);
cek('Foto turun dari galeri publik', !(await j(await fetch(B + '/api/foto'))).foto.some(f => f.id === up.id));
cek('File gambar ikut dihapus (pemilik pun 404)', (await fetch(img, { headers: { Cookie: a.cookie } })).status === 404 && (await fetch(img, { headers: { Cookie: m.cookie } })).status === 404);
const fx = (await j(await fetch(B + '/api/foto/saya', { headers: { Cookie: a.cookie } }))).foto.find(f => f.id === up.id);
cek('Fotoku: status ditolak + alasan, tanpa gambar', fx.status === 'ditolak' && fx.alasan === 'Uji turunkan <b>foto</b>' && fx.src === null, JSON.stringify(fx));
const tol = await j(await fetch(B + '/api/mod/foto?status=ditolak', { headers: { Cookie: m.cookie } }));
cek('Tab Ditolak: ada nama mod & alasan', tol.foto.some(f => f.id === up.id && f.dicekOleh === 'Mod Uji' && f.src === null));

cek('Mod tidak bisa memblokir diri sendiri', (await postJson('/api/mod/pengguna', m.cookie, { id: idUji + '5', blokir: true, alasan: 'uji' })).status === 400);
cek('Blokir tanpa alasan ditolak', (await postJson('/api/mod/pengguna', m.cookie, { id: idUji, blokir: true })).status === 400);
r = await postJson('/api/mod/pengguna', m.cookie, { id: idUji, blokir: true, alasan: 'Uji blokir' });
const bl = await j(r);
cek('Mod memblokir akun + foto menunggunya ikut ditolak', r.status === 200 && bl.fotoDitolak >= 1, JSON.stringify(bl));
const a2 = await login(idUji, 'Pemain Uji');
cek('Akun diblokir: tidak bisa masuk lagi', a2.r.headers.get('location') === '/galeri/?login=diblokir' && !a2.cookie, a2.r.headers.get('location'));
cek('Daftar akun diblokir berisi alasannya', (await j(await fetch(B + '/api/mod/pengguna', { headers: { Cookie: m.cookie } }))).pengguna.some(p => p.id === idUji && p.alasan === 'Uji blokir'));
r = await postJson('/api/mod/pengguna', m.cookie, { id: idUji, blokir: false });
const a3 = await login(idUji, 'Pemain Uji');
cek('Mod membuka blokir -> bisa masuk lagi', r.status === 200 && a3.r.headers.get('location') === '/galeri/?login=ok' && !!a3.cookie);
const rw = await j(await fetch(B + '/api/mod/riwayat', { headers: { Cookie: m.cookie } }));
const aksiMod = rw.riwayat.filter(x => x.mod_nama === 'Mod Uji').map(x => x.aksi);
cek('Riwayat mencatat semua tindakan', ['setujui', 'turunkan', 'blokir', 'buka-blokir'].every(x => aksiMod.includes(x)), aksiMod.join(','));

console.log('== Notifikasi mod (webhook)');
function dbPalsu(menunggu) {
  const kv = {};
  return { kv, prepare(sql) { return { a: [], bind(...x) { this.a = x; return this; },
    async first() { if (sql.includes('FROM pengaturan')) return kv[this.a[0]] ? { nilai: kv[this.a[0]] } : null; return { n: menunggu }; },
    async run() { if (sql.includes('INSERT INTO pengaturan')) kv[this.a[0]] = this.a[1]; return { meta: { changes: 1 } }; } }; } }; // kunci = jenis notifikasi
}
const WH = 'https://discord.com/api/webhooks/123456789/abcDEF_-xyz';
let terkirim = [];
const palsu = async (u, o) => { terkirim.push({ u, body: JSON.parse(o.body) }); return { ok: true }; };
cek('Tanpa webhook: tidak mengirim', (await kabariMod({ DB: dbPalsu(3), SITUS: B }, palsu)) === false && !terkirim.length);
cek('NOTIF_MATI=1: tidak mengirim', (await kabariMod({ DB: dbPalsu(3), SITUS: B, DISCORD_WEBHOOK_MOD: WH, NOTIF_MATI: '1' }, palsu)) === false && !terkirim.length);
cek('Alamat webhook bukan Discord: tidak mengirim', (await kabariMod({ DB: dbPalsu(3), SITUS: B, DISCORD_WEBHOOK_MOD: 'https://situs-jahat.example/api/webhooks/1/x' }, palsu)) === false && !terkirim.length);
const db = dbPalsu(3), envN = { DB: db, SITUS: 'https://chaatown.my.id', DISCORD_WEBHOOK_MOD: WH };
cek('Webhook valid: mengirim 1 pesan', (await kabariMod(envN, palsu)) === true && terkirim.length === 1 && terkirim[0].u === WH);
cek('Isi pesan: jumlah antrean + link mod, tanpa isi dari pengupload', terkirim[0].body.content === pesanNotif(3, 'https://chaatown.my.id') && /\/galeri\/mod\//.test(terkirim[0].body.content));
cek('Pesan tidak bisa me-mention siapa pun (allowed_mentions kosong)', JSON.stringify(terkirim[0].body.allowed_mentions) === '{"parse":[]}');
cek('Upload berikutnya < 10 menit: tidak mengirim lagi (anti-spam)', (await kabariMod(envN, palsu)) === false && terkirim.length === 1);
cek('Notifikasi laporan punya jeda sendiri: tetap terkirim', (await kabariMod(envN, palsu, 'laporan')) === true && terkirim.length === 2 && terkirim[1].body.content === pesanLaporan(3, 'https://chaatown.my.id') && /#laporan/.test(terkirim[1].body.content));
cek('Laporan berikutnya < 10 menit: tidak mengirim lagi', (await kabariMod(envN, palsu, 'laporan')) === false && terkirim.length === 2);

/* ---------- 4. Sosial: nickname, suka, komentar, laporan (Fase G4) ---------- */
console.log('== Nickname');
const pj = (u, ck, data, origin = B) => postJson(u, ck, data, origin);
const c = await login(idUji + '3', 'Pemain Sosial');
r = await kirim(c.cookie, { nick: NICK_UJI });
cek('Nick milik akun lain ditolak (anti-menyamar)', r.status === 409 && /akun Discord lain/.test((await j(r)).galat), r.status);
// Nick yang dipesan (foto arsip) hanya DICOBA, tidak pernah dilepas oleh uji ini
const dipesan = (await j(await fetch(B + '/api/mod/nick', { headers: { Cookie: m.cookie } }))).nick.find(n => !n.pemilik);
if (dipesan) {
  r = await kirim(c.cookie, { nick: dipesan.tampil.toLowerCase() });
  cek('Nick pemilik foto arsip dipesan (' + dipesan.tampil + ')', r.status === 409 && /dipesan/.test((await j(r)).galat), r.status);
} else console.log('  (lewati: tidak ada nick yang masih dipesan di database ini)');
const NICK_C = 'sos' + idUji.slice(-6);
r = await kirim(c.cookie, { nick: NICK_C, caption: 'Foto sosial' }); const fs1 = await j(r);
cek('Nick baru diterima & jadi milik akun ini', r.status === 201, r.status);
r = await kirim(c.cookie, { nick: NICK_C.toUpperCase(), caption: 'Foto sosial 2' }); const fs2 = await j(r);
const sc = await j(await fetch(B + '/api/foto/saya', { headers: { Cookie: c.cookie } }));
cek('Nick sendiri beda huruf besar/kecil: diterima & penulisannya disamakan', r.status === 201 && sc.foto.find(f => f.id === fs2.id).nick === NICK_C);
await kirim(c.cookie, { nick: 'Sos2' + idUji.slice(-6) }); await kirim(c.cookie, { nick: 'Sos3' + idUji.slice(-6) });
r = await kirim(c.cookie, { nick: 'Sos4' + idUji.slice(-6) });
cek('Maksimal 3 nickname per akun Discord', r.status === 400 && /maksimal punya 3/.test((await j(r)).galat), r.status);
cek('/api/saya menampilkan nickname milik akun', (await j(await fetch(B + '/api/saya', { headers: { Cookie: c.cookie } }))).nick.length === 3);
const dn = await j(await fetch(B + '/api/mod/nick', { headers: { Cookie: m.cookie } }));
cek('Mod: daftar nickname berisi pemiliknya', dn.nick.some(n => n.nick === NICK_C.toLowerCase() && n.pemilik.id === idUji + '3') && (!dipesan || dn.nick.some(n => n.nick === dipesan.nick && !n.pemilik)));
const NICK_LEPAS = ('Sos3' + idUji.slice(-6)).toLowerCase(); // nick milik akun uji sendiri
cek('Bukan mod: tidak bisa melepas nickname', (await pj('/api/mod/nick', c.cookie, { nick: NICK_LEPAS, aksi: 'lepas' })).status === 403);
r = await pj('/api/mod/nick', m.cookie, { nick: NICK_LEPAS, aksi: 'lepas' });
cek('Mod melepas nickname -> bebas lagi, kuota nick pemilik berkurang', r.status === 200 && !(await j(await fetch(B + '/api/mod/nick', { headers: { Cookie: m.cookie } }))).nick.some(n => n.nick === NICK_LEPAS)
  && (await j(await fetch(B + '/api/saya', { headers: { Cookie: c.cookie } }))).nick.length === 2);

console.log('== Suka');
await pj('/api/mod/foto', m.cookie, { id: fs1.id, aksi: 'setujui' });
const d = await login(idUji + '4', 'Pemain Penyuka');
cek('Belum login: tidak bisa suka (401)', (await pj('/api/foto/suka', '', { id: fs1.id, suka: true })).status === 401);
cek('Suka tanpa Origin ditolak (anti-CSRF)', (await pj('/api/foto/suka', d.cookie, { id: fs1.id, suka: true }, null)).status === 403);
cek('Foto yang belum tayang tidak bisa disukai', (await pj('/api/foto/suka', d.cookie, { id: fs2.id, suka: true })).status === 404);
cek('Kiriman suka tidak valid ditolak', (await pj('/api/foto/suka', d.cookie, { id: fs1.id, suka: 'ya' })).status === 400);
r = await j(await pj('/api/foto/suka', d.cookie, { id: fs1.id, suka: true }));
const r2 = await j(await pj('/api/foto/suka', d.cookie, { id: fs1.id, suka: true }));
cek('Suka: jumlah naik, klik dua kali tetap dihitung sekali', r.suka === 1 && r.disukai && r2.suka === 1);
const fd1 = (await j(await fetch(B + '/api/foto', { headers: { Cookie: d.cookie } }))).foto.find(f => f.id === fs1.id);
const fa1 = (await j(await fetch(B + '/api/foto'))).foto.find(f => f.id === fs1.id);
cek('Feed: jumlah suka + tanda "disukai" hanya untuk yang menyukai', fd1.suka === 1 && fd1.disukai === true && fa1.disukai === false && fa1.suka === 1);
r = await j(await pj('/api/foto/suka', d.cookie, { id: fs1.id, suka: false }));
cek('Batal suka: jumlah turun', r.suka === 0 && r.disukai === false);
await pj('/api/foto/suka', d.cookie, { id: fs1.id, suka: true });

console.log('== Komentar');
const kom = (ck, isi, id = fs1.id) => pj('/api/foto/komentar', ck, { id, isi });
cek('Belum login: tidak bisa komentar (401)', (await kom('', 'halo')).status === 401);
r = await kom(d.cookie, 'Keren banget!'); const k1 = (await j(r)).komentar;
cek('Komentar langsung tampil', r.status === 201 && k1.isi === 'Keren banget!');
cek('Komentar berisi link ditolak', (await kom(d.cookie, 'cek www.situs-jahat.com')).status === 400 && (await kom(d.cookie, 'join discord.gg/abc')).status === 400);
r = await kom(d.cookie, 'dasar k0nt0l');
cek('Komentar berkata kasar ditolak', r.status === 400 && /tidak diizinkan/.test((await j(r)).galat));
cek('Komentar kosong / > 300 karakter ditolak', (await kom(d.cookie, '   ')).status === 400 && (await kom(d.cookie, 'a'.repeat(301))).status === 400);
cek('Komentar wajar ("pantai") lolos', (await kom(d.cookie, 'Rumahku di pantai')).status === 201);
r = await kom(d.cookie, '<img src=x onerror=alert(1)>'); const kx = (await j(r)).komentar;
cek('Komentar berisi kode disimpan sebagai teks biasa', r.status === 201 && kx.isi === '<img src=x onerror=alert(1)>');
cek('Komentar di foto yang belum tayang ditolak', (await kom(d.cookie, 'halo', fs2.id)).status === 404);
const lk = await j(await fetch(B + '/api/foto/komentar?id=' + fs1.id, { headers: { Cookie: d.cookie } }));
const lka = await j(await fetch(B + '/api/foto/komentar?id=' + fs1.id));
cek('Daftar komentar: urut, ada penulis, "milikku" hanya untuk penulis', lk.komentar.length === 3 && lk.komentar[0].id === k1.id && lk.komentar[0].penulis.nama === 'Pemain Penyuka' && lk.komentar[0].milikku && !lka.komentar[0].milikku);
await kom(d.cookie, 'empat'); await kom(d.cookie, 'lima');
r = await kom(d.cookie, 'enam');
cek('Komentar ke-6 dalam 1 menit ditolak (429)', r.status === 429, r.status);
cek('Akun lain tidak bisa menghapus komentarmu', (await pj('/api/foto/komentar/hapus', c.cookie, { id: kx.id })).status === 403);
cek('Penulis bisa menghapus komentarnya', (await pj('/api/foto/komentar/hapus', d.cookie, { id: kx.id })).status === 200 && !(await j(await fetch(B + '/api/foto/komentar?id=' + fs1.id))).komentar.some(k => k.id === kx.id));
cek('Feed: jumlah komentar ikut', (await j(await fetch(B + '/api/foto'))).foto.find(f => f.id === fs1.id).komentar === 4);

console.log('== Laporan');
const lap = (ck, jenis, id, alasan = 'Spam atau iklan') => pj('/api/lapor', ck, { jenis, id, alasan });
cek('Tidak bisa melaporkan konten sendiri', (await lap(c.cookie, 'foto', fs1.id)).status === 400);
cek('Laporan tanpa alasan ditolak', (await lap(d.cookie, 'foto', fs1.id, '')).status === 400);
cek('Lapor foto', (await lap(d.cookie, 'foto', fs1.id, 'Bukan foto ChaaTown atau bukan miliknya')).status === 201);
cek('Lapor foto yang sama dua kali -> 409', (await lap(d.cookie, 'foto', fs1.id)).status === 409);
const e1 = await login(idUji + '7', 'Pelapor Dua'), e2 = await login(idUji + '2', 'Pelapor Tiga'); // ID '5' = akun mod uji
r = await j(await lap(c.cookie, 'komentar', k1.id, 'Konten tidak pantas'));
cek('Laporan komentar ke-1: belum disembunyikan', r.disembunyikan === false);
await lap(e1.cookie, 'komentar', k1.id);
r = await j(await lap(e2.cookie, 'komentar', k1.id, 'Pelecehan atau ujaran kebencian'));
cek('3 akun melaporkan komentar -> otomatis disembunyikan', r.disembunyikan === true && !(await j(await fetch(B + '/api/foto/komentar?id=' + fs1.id))).komentar.some(k => k.id === k1.id));
const dl = await j(await fetch(B + '/api/mod/laporan', { headers: { Cookie: m.cookie } }));
const lf = dl.laporan.find(x => x.jenis === 'foto' && x.id === fs1.id), lc = dl.laporan.find(x => x.jenis === 'komentar' && x.id === k1.id);
cek('Mod: daftar laporan berisi foto & komentar + alasannya', !!lf && !!lc && lc.jumlah === 3 && lc.komentar.isi === 'Keren banget!' && lc.alasan.length === 3 && dl.jumlah.laporan >= 2);
cek('Bukan mod: tidak bisa melihat laporan', (await fetch(B + '/api/mod/laporan', { headers: { Cookie: d.cookie } })).status === 403);
cek('Mod: /api/saya memberi tahu jumlah laporan', (await j(await fetch(B + '/api/saya', { headers: { Cookie: m.cookie } }))).laporanMod >= 2);
r = await pj('/api/mod/laporan', m.cookie, { jenis: 'komentar', id: k1.id, aksi: 'abaikan' });
cek('Mod mengabaikan laporan -> komentar yang tersembunyi otomatis muncul lagi', r.status === 200 && (await j(await fetch(B + '/api/foto/komentar?id=' + fs1.id))).komentar.some(k => k.id === k1.id));
cek('Bukan mod: tidak bisa menyembunyikan komentar', (await pj('/api/mod/komentar', d.cookie, { id: k1.id, alasan: 'uji' })).status === 403);
r = await pj('/api/mod/komentar', m.cookie, { id: k1.id, alasan: 'Uji sembunyikan' });
cek('Mod menyembunyikan komentar langsung', r.status === 200 && !(await j(await fetch(B + '/api/foto/komentar?id=' + fs1.id))).komentar.some(k => k.id === k1.id));
await pj('/api/mod/pengguna', m.cookie, { id: idUji + '4', blokir: true, alasan: 'Uji blokir komentator' });
cek('Akun diblokir: semua komentarnya ikut disembunyikan', !(await j(await fetch(B + '/api/foto/komentar?id=' + fs1.id))).komentar.some(k => k.penulis.id === idUji + '4'));
await pj('/api/mod/pengguna', m.cookie, { id: idUji + '4', blokir: false });
r = await pj('/api/mod/laporan', m.cookie, { jenis: 'foto', id: fs1.id, aksi: 'tindak', alasan: 'Uji turunkan dari laporan' });
cek('Mod menindak laporan foto -> foto turun', r.status === 200 && !(await j(await fetch(B + '/api/foto'))).foto.some(f => f.id === fs1.id));
cek('Laporan yang sudah ditangani hilang dari daftar', !(await j(await fetch(B + '/api/mod/laporan', { headers: { Cookie: m.cookie } }))).laporan.some(x => x.id === fs1.id || x.id === k1.id));
cek('Komentar di foto yang sudah turun tidak bisa dibuka', (await fetch(B + '/api/foto/komentar?id=' + fs1.id)).status === 404);
const aksiG4 = (await j(await fetch(B + '/api/mod/riwayat', { headers: { Cookie: m.cookie } }))).riwayat.filter(x => x.mod_nama === 'Mod Uji').map(x => x.aksi);
cek('Riwayat mencatat tindakan G4', ['lepas-nick', 'abaikan-laporan', 'sembunyikan-komentar', 'turunkan'].every(x => aksiG4.includes(x)), aksiG4.join(','));

r = await fetch(B + '/api/auth/dev?id=1&balik=' + encodeURIComponent('//situs-jahat.example'), { redirect: 'manual' });
cek('Alamat balik ke situs lain diabaikan (anti open-redirect)', r.headers.get('location') === '/galeri/?login=ok', r.headers.get('location'));
r = await fetch(B + '/api/auth/masuk', { redirect: 'manual' });
cek('Login Discord belum disiapkan -> pesan "belum-siap"', /login=belum-siap|discord\.com\/oauth2\/authorize/.test(r.headers.get('location') || ''), r.headers.get('location'));

cek('Sesi baru aktif sebelum logout', (await j(await fetch(B + '/api/saya', { headers: { Cookie: a3.cookie } }))).masuk === true);
cek('Logout tanpa Origin ditolak', (await fetch(B + '/api/auth/keluar', { method: 'POST', headers: { Cookie: a3.cookie } })).status === 403);
r = await fetch(B + '/api/auth/keluar', { method: 'POST', headers: { Cookie: a3.cookie, ...ORIGIN } });
cek('Logout berhasil', r.status === 200);
cek('Sesi lama tidak berlaku lagi', (await j(await fetch(B + '/api/saya', { headers: { Cookie: a3.cookie } }))).masuk === false);
cek('Cookie sesi palsu ditolak', (await j(await fetch(B + '/api/saya', { headers: { Cookie: '__Host-sesi=' + 'A'.repeat(43) } }))).masuk === false);

console.log('\n' + lolos + ' PASS, ' + gagal + ' FAIL');
process.exit(gagal ? 1 : 0);
