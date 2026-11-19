/* =====================================================================
   Uji SERANG dapur galeri (Fase G5): mencoba cara-cara iseng/jahat dan
   memastikan semuanya ditolak. Jalankan dari folder _api, saat dapur
   sedang jalan:   npm.cmd run serang
   Server lain: set UJI_URL (misalnya UJI_URL=http://localhost:8788).
   CATATAN: membuat akun & foto uji di database server yang dituju, dan
   memakai login uji (DEV_LOGIN=1). Kalau webhook mod diisi, upload uji
   bisa memicu notifikasi ke channel mod (paling sering 1x per 10 menit).
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { devAktif } from '../src/masuk.js';
import { rapikanTeks } from '../src/alat.js';
import { kataKasar } from '../src/kata.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const B = process.env.UJI_URL || 'http://localhost:8787';
let lolos = 0, gagal = 0;
const cek = (nama, ok, info = '') => { ok ? lolos++ : gagal++; console.log((ok ? '  PASS ' : '  FAIL ') + nama + (ok ? '' : '  -> ' + info)); };
const ID = String(Date.now()).slice(-9);
const W = readFileSync(path.join(ROOT, 'galeri/lodge-salju.webp'));
const j = r => r.json();

async function login(id, nama = 'Penyerang', mod = false) {
  const r = await fetch(B + '/api/auth/dev?id=' + id + '&nama=' + encodeURIComponent(nama) + (mod ? '&mod=1' : ''), { redirect: 'manual' });
  return (r.headers.get('set-cookie') || '').match(/__Host-sesi=[^;]+/)?.[0] || '';
}
function upload(cookie, { nick, caption = 'uji', file = W, origin = B } = {}) {
  const fd = new FormData();
  fd.append('foto', new Blob([file]), 'f.webp'); fd.append('nick', nick); fd.append('caption', caption); fd.append('cf-turnstile-response', 'XXXX.DUMMY.TOKEN.XXXX');
  return fetch(B + '/api/foto', { method: 'POST', body: fd, headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) } });
}
const post = (u, cookie, body, h = {}) => fetch(B + u, { method: 'POST', headers: { Cookie: cookie, Origin: B, 'Content-Type': 'application/json', ...h }, body: typeof body === 'string' ? body : JSON.stringify(body) });

try { await fetch(B + '/api/saya'); } catch { console.log('  Server belum jalan di ' + B); process.exit(2); }

// Persiapan: 1 pemain (A) dengan 1 foto tayang + 1 foto menunggu, 1 penyerang (X), 1 mod
const A = await login('91' + ID, 'Korban'), X = await login('92' + ID, 'Penyerang'), M = await login('93' + ID, 'Mod Serang', true);
const fTayang = (await j(await upload(A, { nick: 'Korban' + ID.slice(-5) }))).id;
const fAntre = (await j(await upload(A, { nick: 'Korban' + ID.slice(-5), caption: 'masih menunggu' }))).id;
await post('/api/mod/foto', M, { id: fTayang, aksi: 'setujui' });
const kKorban = (await j(await post('/api/foto/komentar', A, { id: fTayang, isi: 'komentar korban' }))).komentar.id;

console.log('== Kiriman raksasa & rusak (cegah dapur kehabisan memori)');
let r = await post('/api/foto/komentar', X, '{"id":"' + fTayang + '","isi":"' + 'a'.repeat(10 * 1048576) + '"}');
cek('JSON 10 MB langsung ditolak tanpa dibaca', r.status === 400, r.status);
const aliran = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"id":"' + fTayang + '","isi":"halo"}')); c.close(); } });
r = await fetch(B + '/api/foto/komentar', { method: 'POST', body: aliran, duplex: 'half', headers: { Cookie: X, Origin: B, 'Content-Type': 'application/json' } });
cek('JSON tanpa ukuran (dikirim bertahap/chunked) ditolak', r.status === 400, r.status);
cek('JSON rusak ditolak', (await post('/api/foto/komentar', X, '{"id": "' + fTayang + '", isi:')).status === 400);
cek('JSON berupa array ditolak', (await post('/api/foto/komentar', X, '[1,2,3]')).status === 400);
r = await fetch(B + '/api/foto', { method: 'POST', body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(100)); c.close(); } }), duplex: 'half', headers: { Cookie: X, Origin: B, 'Content-Type': 'multipart/form-data; boundary=x' } });
cek('Upload tanpa ukuran (chunked) ditolak (411)', r.status === 411, r.status);
r = await fetch(B + '/api/foto', { method: 'POST', body: '--x\r\nrusak', headers: { Cookie: X, Origin: B, 'Content-Type': 'multipart/form-data; boundary=x' } });
cek('Multipart rusak ditolak', r.status === 400, r.status);
const fdTeks = new FormData(); fdTeks.append('foto', 'ini bukan file'); fdTeks.append('nick', 'Iseng' + ID.slice(-5));
cek('Field "foto" berisi teks (bukan file) ditolak', (await fetch(B + '/api/foto', { method: 'POST', body: fdTeks, headers: { Cookie: X, Origin: B } })).status === 400);
r = await upload(X, { nick: 'Iseng' + ID.slice(-5), caption: 'x'.repeat(1048576) });
const cap = r.status === 201 ? (await j(await fetch(B + '/api/foto/saya', { headers: { Cookie: X } }))).foto[0].caption : '';
cek('Caption 1 MB dipotong jadi maks 150 karakter', r.status === 201 && cap.length === 150, r.status + ' / ' + cap.length);

console.log('== Injeksi SQL & parameter aneh');
cek('status=\' OR 1=1 -- ditolak', (await fetch(B + "/api/mod/foto?status=' OR 1=1 --", { headers: { Cookie: M } })).status === 400);
r = await fetch(B + '/api/foto?sebelum=1;DROP%20TABLE%20foto');
cek('sebelum=1;DROP TABLE -> diabaikan, daftar tetap jalan', r.status === 200 && Array.isArray((await j(r)).foto));
cek("id komentar ' OR '1'='1 -> tidak ditemukan", (await fetch(B + "/api/foto/komentar?id=' OR '1'='1")).status === 404);
cek('Nick berisi SQL ditolak', (await upload(X, { nick: "x' OR 1=1--" })).status === 400);
r = await post('/api/foto/komentar', X, { id: fTayang, isi: "'); DROP TABLE komentar; --" });
cek('Komentar berisi SQL disimpan sebagai teks, tabel tetap utuh', r.status === 201 && (await j(await fetch(B + '/api/foto/komentar?id=' + fTayang))).komentar.some(k => k.isi === "'); DROP TABLE komentar; --"));
cek('ID berupa objek/angka ditolak', (await post('/api/foto/suka', X, { id: { $ne: 1 }, suka: true })).status === 404 && (await post('/api/mod/foto', M, { id: 123, aksi: 'setujui' })).status === 400);

console.log('== Mencuri file (path traversal)');
const rahasia = ['/_api/.dev.vars', '/%5Fapi/.dev.vars', '/_api%2F.dev.vars', '/_api/wrangler.jsonc', '/.git/HEAD', '/.git/config', '/.dev.vars', '/.gitignore',
  '/img/..%2F_api%2F.dev.vars', '/img/%2e%2e/%2e%2e/_api/.dev.vars', '/img/..%5C_api%5C.dev.vars', '/img/' + fTayang + '.webp/../../_api/.dev.vars',
  '/_tools/cek-aset.ps1', '/_api/src/masuk.js', '/_api/node_modules/wrangler/package.json', '/baca%20ini.md'];
const bocor = [];
for (const u of rahasia) {
  const x = await fetch(B + u, { redirect: 'manual' }); const t = await x.text();
  if (x.status === 200 && !/<!DOCTYPE html>/i.test(t.slice(0, 50))) bocor.push(u + ' (' + x.status + ')');
  if (/DISCORD_CLIENT_SECRET|DEV_LOGIN|refs\/heads|\[core\]/.test(t)) bocor.push(u + ' BERISI RAHASIA');
}
cek('Tidak ada file rahasia/kode dapur yang bisa diunduh (' + rahasia.length + ' alamat dicoba)', !bocor.length, bocor.join(', '));

console.log('== Metode & CORS');
cek('PUT/DELETE/PATCH ke API ditolak', (await Promise.all(['PUT', 'DELETE', 'PATCH'].map(m => fetch(B + '/api/foto', { method: m, headers: { Cookie: X, Origin: B } })))).every(x => x.status === 404));
cek('POST ke /img ditolak (405)', (await fetch(B + '/img/' + fTayang + '.webp', { method: 'POST' })).status === 405);
r = await fetch(B + '/api/saya', { headers: { Origin: 'https://situs-jahat.example', Cookie: X } });
const pre = await fetch(B + '/api/foto/komentar', { method: 'OPTIONS', headers: { Origin: 'https://situs-jahat.example', 'Access-Control-Request-Method': 'POST' } });
cek('Situs lain tidak diizinkan membaca balasan (tanpa izin CORS)', !r.headers.get('access-control-allow-origin') && !pre.headers.get('access-control-allow-origin'));

console.log('== Pemalsuan asal (CSRF)');
const asal = ['null', 'https://situs-jahat.example', B + '.situs-jahat.example', B + '/', B.replace('localhost', 'LOCALHOST')];
// Catatan: "https://localhost:<port yang sama>" TIDAK diuji di server lokal, karena wrangler dev sendiri
// menulis ulang Origin itu menjadi "http://..." sebelum sampai ke kode (sudah dibuktikan, Fase G5).
// Di Cloudflare sungguhan header Origin diteruskan apa adanya.
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(B)) asal.push(B.replace(/^https?:/, B.startsWith('https:') ? 'http:' : 'https:'));
const lolosAsal = [];
for (const o of asal) { const x = await post('/api/foto/suka', X, { id: fTayang, suka: true }, { Origin: o }); if (x.status !== 403) lolosAsal.push(o + ' -> ' + x.status); }
cek('Semua ' + asal.length + ' variasi Origin palsu ditolak', !lolosAsal.length, lolosAsal.join(', '));
r = await fetch(B + '/api/foto/suka', { method: 'POST', headers: { Cookie: X, Referer: B + '/galeri/', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: fTayang, suka: true }) });
cek('Hanya Referer (tanpa Origin) ditolak', r.status === 403);

console.log('== Pemalsuan sesi');
const palsu = ['__Host-sesi=' + 'A'.repeat(43), '__Host-sesi=' + "' OR 1=1 --", '__Host-sesi=' + 'x'.repeat(5000), 'sesi=' + X.split('=')[1], '__Host-sesi=' + X.split('=')[1].slice(0, -1) + 'Z'];
cek('Cookie sesi palsu/rusak/dipotong tidak dianggap login', (await Promise.all(palsu.map(c => fetch(B + '/api/saya', { headers: { Cookie: c } }).then(j)))).every(s => s.masuk === false));

console.log('== Hak akses (IDOR & bukan mod)');
cek('Penyerang tidak bisa melihat foto korban yang belum tayang', (await fetch(B + '/img/' + fAntre + '.webp', { headers: { Cookie: X } })).status === 404);
cek('Penyerang tidak bisa menghapus komentar korban', (await post('/api/foto/komentar/hapus', X, { id: kKorban })).status === 403);
cek('/api/foto/saya hanya berisi foto sendiri', !(await j(await fetch(B + '/api/foto/saya', { headers: { Cookie: X } }))).foto.some(f => f.id === fAntre));
const modGet = ['/api/mod/foto', '/api/mod/pengguna', '/api/mod/riwayat', '/api/mod/laporan', '/api/mod/nick'];
const modPost = [['/api/mod/foto', { id: fAntre, aksi: 'setujui' }], ['/api/mod/pengguna', { id: '91' + ID, blokir: true, alasan: 'iseng' }], ['/api/mod/laporan', { jenis: 'foto', id: fTayang, aksi: 'tindak', alasan: 'iseng' }], ['/api/mod/komentar', { id: kKorban, alasan: 'iseng' }], ['/api/mod/nick', { nick: 'gikx', aksi: 'lepas' }]];
const bocorMod = [];
for (const u of modGet) if ((await fetch(B + u, { headers: { Cookie: X } })).status !== 403) bocorMod.push('GET ' + u);
for (const [u, b] of modPost) if ((await post(u, X, b)).status !== 403) bocorMod.push('POST ' + u);
cek('Semua 10 aksi mod ditolak untuk akun biasa', !bocorMod.length, bocorMod.join(', '));
cek('Login uji tidak bisa memberi hak mod lewat parameter aneh', !(await j(await fetch(B + '/api/saya', { headers: { Cookie: await login('94' + ID, 'x', false) } }))).mod);

console.log('== Teks berbahaya');
r = await post('/api/foto/komentar', X, { id: fTayang, isi: '<script>alert(1)</script><img src=x onerror=alert(2)>' });
cek('Komentar berisi HTML: disimpan sebagai teks biasa', r.status === 201 && (await j(r)).komentar.isi === '<script>alert(1)</script><img src=x onerror=alert(2)>');
cek('Balasan API selalu JSON + nosniff (tidak bisa ditafsirkan sebagai HTML)', ['/api/saya', '/api/foto', '/api/foto/komentar?id=' + fTayang, '/api/ngasal'].length === 4 &&
  (await Promise.all(['/api/saya', '/api/foto', '/api/foto/komentar?id=' + fTayang, '/api/ngasal'].map(u => fetch(B + u)))).every(x => /^application\/json/.test(x.headers.get('content-type')) && x.headers.get('x-content-type-options') === 'nosniff'));
const N = await login('95' + ID, 'Ad‮min​​'); // nama Discord dengan pembalik teks & huruf tak terlihat
cek('Nama Discord dengan pembalik teks/huruf tak terlihat dirapikan', (await j(await fetch(B + '/api/saya', { headers: { Cookie: N } }))).nama === 'Admin');
const kasarLolos = ['kon​tol', 'kоntоl', 'ｋｏｎｔｏｌ', 'fu­ck'].filter(t => !kataKasar(rapikanTeks(t, 300)));
cek('Kata kasar dengan huruf tak terlihat / huruf Kiril / huruf lebar tetap ketahuan', !kasarLolos.length, kasarLolos.join(' | '));
r = await post('/api/foto/komentar', X, { id: fTayang, isi: '​​​' });
cek('Komentar isinya cuma huruf tak terlihat ditolak', r.status === 400);
cek('Link disamarkan dengan huruf besar ditolak', (await post('/api/foto/komentar', X, { id: fTayang, isi: 'cek WWW.Situs-Jahat.COM' })).status === 400);

console.log('== Serbuan bersamaan (race condition)');
const Y = await login('96' + ID, 'Penyerbu');
const hasilKom = await Promise.all(Array.from({ length: 12 }, (_, i) => post('/api/foto/komentar', Y, { id: fTayang, isi: 'serbu ' + i })));
const komLolos = hasilKom.filter(x => x.status === 201).length;
cek('12 komentar bersamaan: maks 5 lolos (sisanya 429)', komLolos === 5 && hasilKom.every(x => x.status === 201 || x.status === 429), komLolos + ' lolos');
const hasilSuka = await Promise.all(Array.from({ length: 10 }, () => post('/api/foto/suka', Y, { id: fTayang, suka: true })));
const akhir = await j(await post('/api/foto/suka', Y, { id: fTayang, suka: true }));
cek('10 klik suka bersamaan: tetap dihitung 1', hasilSuka.every(x => x.status === 200) && akhir.suka === (await j(await fetch(B + '/api/foto'))).foto.find(f => f.id === fTayang).suka);
const Z = await login('97' + ID, 'Pengunggah Rakus');
const hasilUp = await Promise.all(Array.from({ length: 10 }, (_, i) => upload(Z, { nick: 'Rakus' + ID.slice(-5), caption: 'serbu ' + i })));
const upLolos = hasilUp.filter(x => x.status === 201).length;
cek('10 upload bersamaan: maks 5 lolos', upLolos <= 5 && upLolos >= 1, upLolos + ' lolos, status: ' + hasilUp.map(x => x.status).join(','));
const hasilLapor = await Promise.all(Array.from({ length: 6 }, () => post('/api/lapor', Y, { jenis: 'komentar', id: kKorban, alasan: 'Spam atau iklan' })));
cek('6 laporan bersamaan untuk konten yang sama: hanya 1 tercatat', hasilLapor.filter(x => x.status === 201).length === 1);

console.log('== Pengaman login uji (tidak bisa bocor ke server asli)');
const u = h => new URL('http://' + h + '/api/auth/dev');
cek('DEV_LOGIN=1 di chaatown.my.id: tetap MATI', devAktif({ DEV_LOGIN: '1', SITUS: 'https://chaatown.my.id' }, u('chaatown.my.id')) === false);
cek('DEV_LOGIN=1 + Host dipalsukan "localhost" tapi SITUS asli: tetap MATI', devAktif({ DEV_LOGIN: '1', SITUS: 'https://chaatown.my.id' }, u('localhost')) === false);
cek('Tanpa DEV_LOGIN di localhost: MATI', devAktif({ SITUS: 'http://localhost:8787' }, u('localhost')) === false);
cek('DEV_LOGIN=1 + semua localhost: hidup (hanya di komputer sendiri)', devAktif({ DEV_LOGIN: '1', SITUS: 'http://localhost:8787' }, u('localhost')) === true);

console.log('\n' + lolos + ' PASS, ' + gagal + ' FAIL');
process.exit(gagal ? 1 : 0);
