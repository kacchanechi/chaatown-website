/* alat.js - fungsi kecil yang dipakai bersama */

const DASAR = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...DASAR, ...headers } });
}
export const galat = (status, pesan, headers) => json({ galat: pesan }, status, headers);
export function alihkan(ke, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: ke, ...DASAR, ...headers } });
}

export const sekarang = () => Math.floor(Date.now() / 1000);

export const ARSIP = 'arsip'; // pemilik khusus 12 foto lama (Fase G4b), bukan akun Discord
/** Alamat gambar: foto lama = file situs (galeri/...), foto upload = /img/<id>.<jenis> dari R2 */
export const srcFoto = f => f.berkas ? '/' + f.berkas : '/img/' + f.id + '.' + f.jenis;

export function acak(byte = 32) {
  const a = crypto.getRandomValues(new Uint8Array(byte));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(teks) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function bacaCookie(req, nama) {
  const c = req.headers.get('Cookie') || '';
  for (const bagian of c.split(';')) {
    const i = bagian.indexOf('=');
    if (i > -1 && bagian.slice(0, i).trim() === nama) return bagian.slice(i + 1).trim();
  }
  return null;
}

/** Cookie aman: HttpOnly (tidak bisa dibaca JavaScript), Secure, SameSite=Lax. */
export function buatCookie(nama, isi, { umur, path = '/' } = {}) {
  let s = nama + '=' + isi + '; Path=' + path + '; HttpOnly; Secure; SameSite=Lax';
  if (umur != null) s += '; Max-Age=' + umur;
  return s;
}

/** Tolak permintaan yang mengubah data kalau bukan dari situs kita sendiri (perlindungan CSRF). */
export function asalSah(req, env) {
  const asal = req.headers.get('Origin');
  return !!asal && asal === new URL(env.SITUS).origin;
}

/** Baca kiriman JSON kecil (maks 4 KB). Hasil: objek, atau null kalau bukan JSON / rusak / kebesaran. */
export async function bacaJson(req) {
  if (!(req.headers.get('Content-Type') || '').startsWith('application/json')) return null;
  // Cek ukuran SEBELUM membaca: kiriman raksasa tidak pernah dimuat ke memori
  const panjang = Number(req.headers.get('Content-Length') || NaN);
  if (!(panjang > 0 && panjang <= 4096)) return null;
  const t = await req.text();
  if (t.length > 4096) return null;
  try { const j = JSON.parse(t); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch { return null; }
}

/**
 * Batas kecepatan: true kalau masih boleh (maks kali dalam jendela "detik").
 * Contoh: cekBatas(env, 'komen:' + idAkun, 5, 60) -> maksimal 5 komentar per menit.
 */
export async function cekBatas(env, kunci, maks, detik) {
  const t = sekarang();
  const r = await env.DB.prepare(
    'INSERT INTO batas (kunci, mulai, jumlah) VALUES (?1, ?2, 1) ON CONFLICT(kunci) DO UPDATE SET ' +
    'jumlah = CASE WHEN batas.mulai <= ?2 - ?3 THEN 1 ELSE batas.jumlah + 1 END, ' +
    'mulai = CASE WHEN batas.mulai <= ?2 - ?3 THEN ?2 ELSE batas.mulai END RETURNING jumlah'
  ).bind(kunci, t, detik).first();
  return r.jumlah <= maks;
}

/** Rapikan teks bebas: buang karakter kontrol & tak terlihat, satukan spasi, potong panjangnya. */
export function rapikanTeks(s, maks) {
  return String(s || '').normalize('NFC')
    .replace(/(?!‍)\p{Cf}/gu, '')          // karakter tak terlihat (zero-width, pembalik teks) DIHAPUS, jadi "kon​tol" tetap terbaca utuh. ‍ = "lem" emoji gabungan, dibiarkan
    .replace(/[\p{Cc}\p{Co}\p{Cn}]/gu, ' ')       // karakter kontrol (tab, baris baru, dll.) jadi spasi
    .replace(/\s+/g, ' ').trim().slice(0, maks);
}
