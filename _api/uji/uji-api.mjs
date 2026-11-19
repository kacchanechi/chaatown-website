/* =====================================================================
   Uji dapur galeri. Jalankan dari folder _api, saat "npm run dev" sedang jalan
   di terminal lain:   npm run uji
   Butuh internet (verifikasi anti-bot memakai kunci uji resmi Cloudflare).
   Aman diulang: setiap putaran memakai akun uji baru.
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { periksaGambar, Tolak } from '../src/berkas.js';

const DIR = path.dirname(fileURLToPath(import.meta.url)), API = path.join(DIR, '..'), ROOT = path.join(API, '..');
const B = 'http://localhost:8787', ORIGIN = { Origin: B };
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

/* ---------- 2. Dapur galeri (server lokal) ---------- */
console.log('== Dapur galeri (' + B + ')');
const idUji = String(Date.now()) + String(Math.floor(Math.random() * 1e4)).padStart(4, '0');
async function login(id, nama) {
  const r = await fetch(B + '/api/auth/dev?id=' + id + '&nama=' + encodeURIComponent(nama), { redirect: 'manual' });
  const sc = r.headers.get('set-cookie') || '';
  return { r, sc, cookie: (sc.match(/__Host-sesi=[^;]+/) || [''])[0] };
}
function kirim(cookie, { file = W, nama = 'foto.webp', nick = 'Steve123', caption = 'Uji', ts = 'XXXX.DUMMY.TOKEN.XXXX', origin = B } = {}) {
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

execSync(`npx wrangler d1 execute DB --local --command "UPDATE foto SET status='tayang' WHERE id='${up.id}'"`, { cwd: API, stdio: 'ignore' });
const pub = await j(await fetch(B + '/api/foto'));
const fp = pub.foto.find(f => f.id === up.id);
cek('Setelah disetujui: muncul di galeri publik', !!fp && fp.nick === 'Steve123' && fp.pemilik.nama === 'Pemain Uji');
const rp = await fetch(img);
cek('Setelah disetujui: gambar bisa dibuka publik & boleh di-cache', rp.status === 200 && /public/.test(rp.headers.get('cache-control')));

r = await fetch(B + '/api/auth/dev?id=1&balik=' + encodeURIComponent('//situs-jahat.example'), { redirect: 'manual' });
cek('Alamat balik ke situs lain diabaikan (anti open-redirect)', r.headers.get('location') === '/galeri/?login=ok', r.headers.get('location'));
r = await fetch(B + '/api/auth/masuk', { redirect: 'manual' });
cek('Login Discord belum disiapkan -> pesan "belum-siap"', /login=belum-siap|discord\.com\/oauth2\/authorize/.test(r.headers.get('location') || ''), r.headers.get('location'));

cek('Logout tanpa Origin ditolak', (await fetch(B + '/api/auth/keluar', { method: 'POST', headers: { Cookie: a.cookie } })).status === 403);
r = await fetch(B + '/api/auth/keluar', { method: 'POST', headers: { Cookie: a.cookie, ...ORIGIN } });
cek('Logout berhasil', r.status === 200);
cek('Sesi lama tidak berlaku lagi', (await j(await fetch(B + '/api/saya', { headers: { Cookie: a.cookie } }))).masuk === false);
cek('Cookie sesi palsu ditolak', (await j(await fetch(B + '/api/saya', { headers: { Cookie: '__Host-sesi=' + 'A'.repeat(43) } }))).masuk === false);

console.log('\n' + lolos + ' PASS, ' + gagal + ' FAIL');
process.exit(gagal ? 1 : 0);
