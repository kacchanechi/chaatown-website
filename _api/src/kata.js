/* =====================================================================
   kata.js - filter kata kasar untuk komentar galeri

   BOLEH DIUBAH: tambah/hapus kata di daftar KATA (huruf kecil, satu kata).
   Sengaja TIDAK memasukkan kata yang juga nama hewan/benda di Minecraft
   (misalnya "anjing", "babi") supaya komentar biasa tidak ikut ditolak.

   Yang dikenali juga: huruf diganti angka/simbol (k0nt0l, b4ngs4t),
   huruf diulang 3x atau lebih (kontolll), dan huruf dipisah titik/spasi (k.o.n.t.o.l).
   Pencocokan per kata utuh, jadi "pantai" tidak dianggap mengandung "tai".
   ===================================================================== */

export const KATA = [
  // Indonesia / daerah
  'kontol', 'memek', 'ngentot', 'entot', 'ngewe', 'jembut', 'pepek', 'peler', 'titit', 'coli', 'colmek',
  'bangsat', 'bajingan', 'keparat', 'brengsek', 'goblok', 'goblog', 'tolol', 'jancok', 'jancuk', 'cok', 'asu',
  'kampret', 'perek', 'lonte', 'pelacur', 'sundal', 'bego', 'idiot', 'cacat',
  // Inggris
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bitch', 'bastard', 'dick', 'pussy', 'cunt',
  'nigga', 'nigger', 'faggot', 'retard', 'whore', 'slut'
];

const ganti = { '4': 'a', '@': 'a', '1': 'i', '!': 'i', '|': 'i', '0': 'o', '3': 'e', '5': 's', '$': 's', '7': 't', '8': 'b', '9': 'g' };
// Huruf Kiril/Yunani yang bentuknya kembar dengan huruf Latin (trik "kоntоl" pakai о Rusia)
const KEMBAR = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'к': 'k', 'т': 't', 'м': 'm', 'в': 'b', 'н': 'h', 'ο': 'o', 'α': 'a', 'ι': 'i', 'κ': 'k', 'τ': 't', 'ν': 'v' };
// Huruf yang diulang 3x atau lebih dianggap penekanan: kontolll -> kontol / kontoll, fuuuck -> fuck.
// Huruf dobel biasa dibiarkan, jadi "cook" tidak berubah menjadi "cok".
const varian = w => [w, w.replace(/(\p{L})\1{2,}/gu, '$1'), w.replace(/(\p{L})\1{2,}/gu, '$1$1')];
const DAFTAR = new Set(KATA);

function normal(teks) {
  return String(teks).toLowerCase()
    .normalize('NFKD').replace(/\p{M}/gu, '')                           // hapus tanda aksen (huruf lebar ｋｏｎｔｏｌ juga jadi biasa)
    .replace(/(?!‍)\p{Cf}/gu, '')                                   // huruf tak terlihat di tengah kata dihapus
    .replace(/[Ͱ-ϿЀ-ӿ]/g, c => KEMBAR[c] || c)       // huruf kembar Kiril/Yunani -> Latin
    .replace(/[!|?.,;:]+(?=\s|$)/g, ' ')                                 // tanda baca di ujung kata ("Bajingan!") bukan huruf samaran
    .replace(/\b(?:[\p{L}\d@$!|][\s.\-_*+]){2,}[\p{L}\d@$!|]\b/gu, m => m.replace(/[\s.\-_*+]/g, '')) // k.o.n.t.o.l -> kontol
    .replace(/[4@1!|035$789]/g, c => ganti[c]);
}

/** true kalau teks mengandung kata dari daftar */
export function kataKasar(teks) {
  return normal(teks).split(/[^\p{L}]+/u).some(k => k && varian(k).some(v => DAFTAR.has(v)));
}
