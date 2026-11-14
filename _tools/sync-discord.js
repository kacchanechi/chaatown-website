#!/usr/bin/env node
/* =====================================================================
   ChaaTown - sinkron daftar channel Discord ke discord/index.html
   ---------------------------------------------------------------------
   Pemakaian (dari folder proyek):
     node _tools/sync-discord.js cek      [--role <id>]
         Hanya membaca: daftar role & channel, siapa yang bisa melihatnya.
         Tidak mengubah file apa pun.
     node _tools/sync-discord.js sinkron  [--role <id>] [--coba]
         Menulis ulang daftar channel di discord/index.html, HANYA di antara
         penanda <!-- sinkron-discord:mulai --> dan <!-- sinkron-discord:selesai -->.
         --coba  = tampilkan hasilnya saja, file tidak ditulis.

   Token bot dibaca dari C:\Users\<user>\.chaatown\discord-token.txt (di luar
   proyek, jadi tidak ikut git/zip). Token TIDAK PERNAH dicetak dan TIDAK
   PERNAH masuk ke file situs. Bot tidak butuh izin apa pun (permissions=0).

   Deskripsi (<span>) & label disimpan di _tools/discord-channels.json,
   dikunci per channel ID: ganti nama channel di Discord tidak memutus
   deskripsinya. Channel yang belum ada di file itu TIDAK ditulis ke situs,
   hanya dilaporkan (aman untuk voice room sementara buatan TempVoice).
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(__dirname, 'discord-channels.json');
const PAGE = path.join(ROOT, 'discord', 'index.html');
const TOKEN_FILE = path.join(os.homedir(), '.chaatown', 'discord-token.txt');
const GUILD_DEFAULT = '1338010772860833814';
const API = 'https://discord.com/api/v10';
const MULAI = '<!-- sinkron-discord:mulai', SELESAI = '<!-- sinkron-discord:selesai -->';

const VIEW = 1n << 10n, CONNECT = 1n << 20n, ADMIN = 1n << 3n;
const TIPE = { 0: 'teks', 2: 'voice', 4: 'kategori', 5: 'pengumuman', 13: 'stage', 15: 'forum', 16: 'media' };
const SUARA = new Set([2, 13]);

/* ---------- argumen ---------- */
const args = process.argv.slice(2);
const mode = args[0];
const opt = n => { const i = args.indexOf(n); return i > -1 ? (args[i + 1] || '') : null; };
const flag = n => args.includes(n);
if (!['cek', 'sinkron'].includes(mode)) {
  console.log('Pakai: node _tools/sync-discord.js cek|sinkron [--role <id>] [--coba]');
  process.exit(2);
}

/* ---------- data lokal ---------- */
const data = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : {};
const GUILD = data.guild || GUILD_DEFAULT;
const roleArg = opt('--role');
const memberRoles = roleArg ? [roleArg] : (data.roleMember ? [].concat(data.roleMember) : []);

/* ---------- akses Discord ---------- */
function bacaToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error('File token belum ada: ' + TOKEN_FILE);
    console.error('Simpan token bot di file itu (satu baris), lalu jalankan lagi.');
    process.exit(1);
  }
  const t = fs.readFileSync(TOKEN_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
  if (!/^[\w.-]{50,}$/.test(t)) { console.error('Isi file token tidak terlihat seperti token bot (cek spasi/baris ekstra).'); process.exit(1); }
  return t;
}
const TOKEN = bacaToken();

async function get(p, bolehGagal) {
  for (let coba = 0; coba < 3; coba++) {
    const res = await fetch(API + p, { headers: { Authorization: 'Bot ' + TOKEN, 'User-Agent': 'DiscordBot (local-sync, 1.0)' } });
    if (res.status === 429) { const j = await res.json().catch(() => ({})); await new Promise(r => setTimeout(r, Math.ceil((j.retry_after || 1) * 1000))); continue; }
    if (res.ok) return res.json();
    if (bolehGagal) return null;
    const pesan = {
      401: 'Token ditolak (401). Token salah atau sudah di-reset; simpan token terbaru di file token.',
      403: 'Akses ditolak (403). Bot belum ada di server ini, atau server ID salah.',
      404: 'Server tidak ditemukan (404). Bot belum diundang ke server ini, atau server ID salah.'
    }[res.status] || ('Discord menjawab HTTP ' + res.status + ' untuk ' + p);
    console.error(pesan); process.exit(1);
  }
  console.error('Terlalu banyak rate limit, coba lagi sebentar lagi.'); process.exit(1);
}

/* ---------- izin: apakah member biasa bisa melihat channel ini? ---------- */
function makeCanView(roles) {
  const byId = new Map(roles.map(r => [r.id, r]));
  const everyone = byId.get(GUILD);
  return function canView(ch, extra) {
    let p = BigInt(everyone.permissions);
    for (const id of extra) if (byId.has(id)) p |= BigInt(byId.get(id).permissions);
    if (p & ADMIN) return true;
    const ow = ch.permission_overwrites || [];
    const e = ow.find(o => o.id === GUILD);
    if (e) { p &= ~BigInt(e.deny); p |= BigInt(e.allow); }
    let a = 0n, d = 0n;
    for (const o of ow) if (Number(o.type) === 0 && o.id !== GUILD && extra.includes(o.id)) { a |= BigInt(o.allow); d |= BigInt(o.deny); }
    p &= ~d; p |= a;
    // voice: harus bisa dilihat DAN dimasuki (Connect ditolak = bergembok di Discord)
    const perlu = SUARA.has(ch.type) ? (VIEW | CONNECT) : VIEW;
    return (p & perlu) === perlu;
  };
}

/* ---------- urutan seperti di aplikasi Discord ---------- */
const byPos = (a, b) => (a.position - b.position) || (BigInt(a.id) < BigInt(b.id) ? -1 : 1);
function susun(channels) {
  const cats = channels.filter(c => c.type === 4).sort(byPos);
  const anak = id => {
    const xs = channels.filter(c => c.type !== 4 && (c.parent_id || null) === id);
    return xs.filter(c => !SUARA.has(c.type)).sort(byPos).concat(xs.filter(c => SUARA.has(c.type)).sort(byPos));
  };
  return [{ cat: null, items: anak(null) }].concat(cats.map(c => ({ cat: c, items: anak(c.id) })));
}

/* ---------- nama rapi sesuai tema situs: tanpa strip, emoji & hiasan ---------- */
const KHUSUS = { ip: 'IP', owo: 'OwO', vip: 'VIP', mc: 'MC', faq: 'FAQ' };
function rapi(nama) {
  // NFKC: huruf "fancy" (𝐠𝐞𝐧) jadi biasa; lalu buang semua selain huruf Latin & angka
  // (\p{Lm} ikut dibuang: hiasan seperti ˎˊ dihitung Unicode sebagai "huruf modifier")
  const s = nama.normalize('NFKC').replace(/(?:[^\p{Script=Latin}\p{Nd}]|\p{Lm})+/gu, ' ').trim().toLowerCase();
  if (!s) return nama;
  return s.split(' ').map(w => KHUSUS[w] || (w[0].toUpperCase() + w.slice(1))).join(' ');
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ===================================================================== */
(async () => {
  const guild = await get('/guilds/' + GUILD);
  const roles = await get('/guilds/' + GUILD + '/roles');
  const channels = await get('/guilds/' + GUILD + '/channels');
  const canView = makeCanView(roles);
  const roleName = id => (roles.find(r => r.id === id) || {}).name || id;
  const grup = susun(channels);

  if (mode === 'cek') {
    console.log('Server : ' + guild.name + '  (id ' + GUILD + ')');
    console.log('Channel: ' + channels.length + ', role: ' + roles.length + '\n');

    console.log('== ROLE (urut dari atas) ==');
    for (const r of roles.slice().sort((a, b) => b.position - a.position)) {
      const p = BigInt(r.permissions);
      const tanda = [r.id === GUILD ? '@everyone' : '', r.managed ? 'bot/integrasi' : '', p & ADMIN ? 'ADMIN' : '', p & VIEW ? 'lihat-channel' : ''].filter(Boolean).join(', ');
      console.log('  ' + r.id.padEnd(20) + ' ' + r.name.padEnd(28) + ' ' + tanda);
    }

    const ob = await get('/guilds/' + GUILD + '/onboarding', true);
    console.log('\n== ONBOARDING ==');
    if (!ob) console.log('  (tidak bisa dibaca oleh bot - tidak masalah)');
    else {
      console.log('  aktif: ' + ob.enabled + ', channel default: ' + (ob.default_channel_ids || []).length);
      const rIds = new Set();
      for (const pr of ob.prompts || []) for (const o of pr.options || []) for (const id of o.role_ids || []) rIds.add(id);
      console.log('  role yang dibagikan lewat onboarding: ' + (rIds.size ? [...rIds].map(roleName).join(', ') : '(tidak ada)'));
    }

    const kolomRole = memberRoles.length ? '  +' + memberRoles.map(roleName).join('+') : '';
    console.log('\n== CHANNEL (urutan Discord) ==   L = terlihat member, - = tidak');
    console.log('  kolom: @everyone' + kolomRole);
    for (const g of grup) {
      if (g.cat) {
        const v = canView(g.cat, []) ? 'L' : '-', v2 = memberRoles.length ? (canView(g.cat, memberRoles) ? 'L' : '-') : '';
        console.log('\n[' + v + (v2 ? ' ' + v2 : '') + '] KATEGORI "' + g.cat.name + '"  -> "' + rapi(g.cat.name) + '"  id ' + g.cat.id);
      } else if (g.items.length) console.log('\n(tanpa kategori)');
      for (const c of g.items) {
        const v = canView(c, []) ? 'L' : '-', v2 = memberRoles.length ? (canView(c, memberRoles) ? 'L' : '-') : '';
        const izin = (c.permission_overwrites || []).filter(o => Number(o.type) === 0 && o.id !== GUILD && (BigInt(o.allow) & VIEW)).map(o => roleName(o.id));
        const ada = data.channel && data.channel[c.id] ? '  [sudah di json]' : '';
        console.log('   [' + v + (v2 ? ' ' + v2 : '') + '] ' + (TIPE[c.type] || ('tipe ' + c.type)).padEnd(10) + ' ' + c.name.padEnd(30) + ' -> ' + rapi(c.name).padEnd(24) + ' id ' + c.id +
          (izin.length ? '  | dibuka khusus untuk: ' + izin.join(', ') : '') + ada);
      }
    }
    console.log('\nSelesai. Tidak ada file yang diubah.');
    return;
  }

  /* ---------- mode sinkron ---------- */
  const html = fs.readFileSync(PAGE, 'utf8');
  const i0 = html.indexOf(MULAI), i1 = html.indexOf(SELESAI);
  if (i0 < 0 || i1 < 0 || i1 < i0) { console.error('Penanda sinkron-discord tidak ditemukan di discord/index.html.'); process.exit(1); }
  const startEnd = html.indexOf('-->', i0) + 3;
  const lama = html.slice(startEnd, i1);
  const beku = new Set(data.beku || []);
  const known = data.channel || {};
  const ind = '      ';
  const out = [], baru = [], tersembunyi = [], dilewati = [];

  for (const g of grup) {
    if (g.cat && beku.has(g.cat.id)) {
      // kategori yang dibekukan: salin apa adanya dari halaman sekarang
      const m = lama.match(new RegExp('<!-- beku:' + g.cat.id + ' -->[\\s\\S]*?<!-- /beku -->'));
      if (!m) { console.error('Kategori beku ' + g.cat.id + ' tidak punya blok <!-- beku:' + g.cat.id + ' --> di halaman.'); process.exit(1); }
      out.push(ind + m[0]);
      continue;
    }
    const baris = [];
    for (const c of g.items) {
      const k = known[c.id];
      const lihat = canView(c, memberRoles);
      if (!k) { if (lihat) baru.push(c); continue; }
      if (k.sembunyi) { dilewati.push(c); continue; }
      if (!lihat) { tersembunyi.push(c); continue; }
      const nama = k.nama || rapi(c.name);
      baris.push(ind + '<p class="it"><b><a href="https://discord.com/channels/' + GUILD + '/' + c.id + '" target="_blank" rel="noopener">' + esc(nama) + '</a></b><i></i><span>' + esc(k.desc) + '</span></p>');
    }
    if (!baris.length) continue;
    if (g.cat) out.push(ind + '<h4 class="cat">' + esc((data.kategori && data.kategori[g.cat.id]) || rapi(g.cat.name)) + '</h4>');
    out.push(...baris);
  }

  const hasil = html.slice(0, startEnd) + '\n' + out.join('\n') + '\n' + ind + html.slice(i1);
  const ids = new Set(channels.map(c => c.id));
  const hilang = Object.keys(known).filter(id => !ids.has(id));

  if (baru.length) { console.log('BARU (terlihat member, belum ada di discord-channels.json, TIDAK ditulis):'); for (const c of baru) console.log('  ' + c.id + '  ' + c.name + '  -> ' + rapi(c.name)); }
  if (tersembunyi.length) { console.log('Ada di json tapi sekarang TIDAK terlihat member (tidak ditulis):'); for (const c of tersembunyi) console.log('  ' + c.id + '  ' + c.name); }
  if (hilang.length) { console.log('Ada di json tapi channel-nya SUDAH DIHAPUS di Discord:'); for (const id of hilang) console.log('  ' + id + '  ' + (known[id].nama || '')); }
  if (dilewati.length) console.log('Sengaja disembunyikan (sembunyi:true): ' + dilewati.map(c => c.name).join(', '));

  if (flag('--coba')) { console.log('\n--- hasil (tidak ditulis) ---\n' + out.join('\n')); return; }
  if (hasil === html) { console.log('\nTidak ada perubahan. discord/index.html sudah sesuai.'); return; }
  fs.writeFileSync(PAGE, hasil, 'utf8');
  console.log('\ndiscord/index.html diperbarui (' + out.length + ' baris di antara penanda).');
})().catch(e => { console.error('Gagal: ' + (e && e.message ? e.message.replace(TOKEN, '***') : e)); process.exit(1); });
