/* =====================================================================
   berkas.js - pemeriksa & pembersih file gambar (inti keamanan upload)

   Cara kerjanya: file TIDAK dipercaya dari nama atau jenisnya. Isi file
   dibongkar bagian per bagian, lalu file BARU disusun ulang hanya dari
   bagian gambar yang diizinkan. Akibatnya:
   - metadata (EXIF/GPS lokasi, XMP, profil warna, komentar) ikut terbuang,
   - data tempelan setelah akhir gambar (trik file "polyglot") terbuang,
   - bagian yang tidak dikenal atau aneh membuat file ditolak.
   Hanya WebP dan JPG yang diterima. Browser pengunjung sudah mengubah
   JPG/PNG/WebP aslinya menjadi salah satu dari dua format ini sebelum upload.
   ===================================================================== */

export class Tolak extends Error {}
const rusak = () => new Tolak('File gambar rusak atau tidak lengkap.');

const fourcc = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const u32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const u24 = (b, o) => b[o] | b[o + 1] << 8 | b[o + 2] << 16;
const u16be = (b, o) => b[o] << 8 | b[o + 1];
const tampil = s => s.replace(/[^A-Za-z0-9 ]/g, '?');

export const BATAS_SISI = { min: 64, maks: 4096 };

/** Periksa + bersihkan. Hasil: { jenis: 'webp'|'jpg', lebar, tinggi, isi: Uint8Array } */
export function periksaGambar(b) {
  if (!(b instanceof Uint8Array) || b.length < 32) throw new Tolak('File terlalu kecil atau rusak.');
  let h;
  if (fourcc(b, 0) === 'RIFF' && fourcc(b, 8) === 'WEBP') h = webp(b);
  else if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) h = jpg(b);
  else throw new Tolak('Format tidak didukung. Pakai foto JPG, PNG, atau WebP.');
  const { min, maks } = BATAS_SISI;
  if (h.lebar < min || h.tinggi < min) throw new Tolak('Foto terlalu kecil (minimal ' + min + ' piksel per sisi).');
  if (h.lebar > maks || h.tinggi > maks) throw new Tolak('Foto terlalu besar (maksimal ' + maks + ' piksel per sisi).');
  return h;
}

/* ---------- WebP ---------- */
function webp(b) {
  const riff = u32(b, 4) + 8;
  if (riff > b.length) throw rusak();          // terpotong
  if (riff < 20) throw rusak();
  // riff < b.length: ada data tempelan di belakang -> diabaikan (tidak ikut disalin)
  const simpan = []; // potongan yang disalin ke file baru
  let o = 12, vp8x = null, vp8xPos = -1, alph = false, img = null;
  while (o < riff) {
    if (o + 8 > riff) throw rusak();
    const id = fourcc(b, o), n = u32(b, o + 4), d = o + 8, akhir = d + n, pad = n & 1;
    if (akhir + pad > riff) throw rusak();
    const potong = () => simpan.push(b.subarray(o, akhir + pad));
    if (id === 'VP8X') {
      if (o !== 12 || n !== 10) throw rusak();
      const f = b[d];
      if (f & 0x02) throw new Tolak('Foto bergerak (animasi) tidak didukung.');
      if (f & 0xC1) throw rusak(); // bit cadangan harus 0
      vp8x = { lebar: u24(b, d + 4) + 1, tinggi: u24(b, d + 7) + 1, alpha: !!(f & 0x10) };
      vp8xPos = simpan.length; potong();
    } else if (id === 'ICCP' || id === 'EXIF' || id === 'XMP ') {
      // metadata: dibuang
    } else if (id === 'ALPH') {
      if (!vp8x || alph || img) throw rusak();
      alph = true; potong();
    } else if (id === 'VP8 ') {
      if (img || n < 10) throw rusak();
      if (b[d] & 1) throw rusak(); // harus key frame
      if (b[d + 3] !== 0x9D || b[d + 4] !== 0x01 || b[d + 5] !== 0x2A) throw rusak();
      img = { lebar: (b[d + 6] | b[d + 7] << 8) & 0x3FFF, tinggi: (b[d + 8] | b[d + 9] << 8) & 0x3FFF };
      potong();
    } else if (id === 'VP8L') {
      if (img || n < 5 || b[d] !== 0x2F) throw rusak();
      const bits = u32(b, d + 1);
      if (bits >>> 29 !== 0) throw rusak(); // versi harus 0
      img = { lebar: (bits & 0x3FFF) + 1, tinggi: ((bits >>> 14) & 0x3FFF) + 1 };
      potong();
    } else if (id === 'ANIM' || id === 'ANMF') {
      throw new Tolak('Foto bergerak (animasi) tidak didukung.');
    } else {
      throw new Tolak('File WebP berisi bagian yang tidak diizinkan (' + tampil(id) + ').');
    }
    o = akhir + pad;
  }
  if (!img || !img.lebar || !img.tinggi) throw rusak();
  if (alph && !vp8x.alpha) throw rusak();
  if (vp8x && (vp8x.lebar !== img.lebar || vp8x.tinggi !== img.tinggi)) throw rusak();

  if (vp8xPos > -1) { // salin VP8X dengan bendera metadata dimatikan (sisakan bit alpha saja)
    const c = simpan[vp8xPos].slice(); c[8] &= 0x10; simpan[vp8xPos] = c;
  }
  const total = 4 + simpan.reduce((s, x) => s + x.length, 0);
  const isi = new Uint8Array(8 + total);
  isi.set([0x52, 0x49, 0x46, 0x46, total & 255, total >>> 8 & 255, total >>> 16 & 255, total >>> 24 & 255, 0x57, 0x45, 0x42, 0x50]);
  let p = 12; for (const x of simpan) { isi.set(x, p); p += x.length; }
  return { jenis: 'webp', lebar: img.lebar, tinggi: img.tinggi, isi };
}

/* ---------- JPG ---------- */
// Segmen yang disalin. Selain ini: APP1-APP15 & COM (metadata) dibuang, lainnya ditolak.
const JPG_BOLEH = new Set([0xC0, 0xC1, 0xC2, 0xC4, 0xDB, 0xDD, 0xE0]); // SOF0/1/2, DHT, DQT, DRI, APP0
function jpg(b) {
  const simpan = [b.subarray(0, 2)]; // SOI
  let o = 2, sof = null, scan = false;
  for (;;) {
    if (o + 2 > b.length || b[o] !== 0xFF) throw rusak();
    let m = b[o + 1];
    while (m === 0xFF) { o++; if (o + 2 > b.length) throw rusak(); m = b[o + 1]; } // byte pengisi
    if (m === 0xD9) { // EOI: akhir gambar. Data tempelan setelahnya diabaikan.
      if (!sof || !scan) throw rusak();
      simpan.push(b.subarray(o, o + 2));
      break;
    }
    if (o + 4 > b.length) throw rusak();
    const n = u16be(b, o + 2);
    if (n < 2 || o + 2 + n > b.length) throw rusak();
    if (m === 0xDA) { // SOS + data gambar sampai penanda berikutnya
      if (!sof) throw rusak();
      let p = o + 2 + n;
      while (p < b.length - 1 && !(b[p] === 0xFF && b[p + 1] !== 0x00 && !(b[p + 1] >= 0xD0 && b[p + 1] <= 0xD7))) p++;
      if (p >= b.length - 1) throw rusak();
      simpan.push(b.subarray(o, p)); scan = true; o = p; continue;
    }
    if ((m >= 0xE1 && m <= 0xEF) || m === 0xFE) { o += 2 + n; continue; } // metadata: dibuang
    if (!JPG_BOLEH.has(m)) throw new Tolak('File JPG berisi bagian yang tidak diizinkan.');
    if (m >= 0xC0 && m <= 0xC2) {
      if (sof || n < 8) throw rusak();
      sof = { tinggi: u16be(b, o + 5), lebar: u16be(b, o + 7) };
    }
    simpan.push(b.subarray(o, o + 2 + n));
    o += 2 + n;
  }
  if (!sof.lebar || !sof.tinggi) throw rusak();
  const isi = new Uint8Array(simpan.reduce((s, x) => s + x.length, 0));
  let p = 0; for (const x of simpan) { isi.set(x, p); p += x.length; }
  return { jenis: 'jpg', lebar: sof.lebar, tinggi: sof.tinggi, isi };
}
