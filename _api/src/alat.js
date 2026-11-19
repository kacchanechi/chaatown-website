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

/** Rapikan teks bebas: buang karakter kontrol & tak terlihat, satukan spasi, potong panjangnya. */
export function rapikanTeks(s, maks) {
  return String(s || '').normalize('NFC')
    .replace(/[\p{Cc}\p{Co}\p{Cn}]|(?!‍)\p{Cf}/gu, ' ') // ‍ = "lem" emoji gabungan, dibiarkan
    .replace(/\s+/g, ' ').trim().slice(0, maks);
}
