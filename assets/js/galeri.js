/* =====================================================================
   ChaaTown - galeri.js (khusus galeri/index.html)
   - Feed foto, profil per pemain (alamat ?pemain=Nama), dan lightbox.
   - Foto = foto upload yang sudah disetujui mod (dari /api/foto) + 12 foto
     arsip di PHOTOS di bawah. Kalau dapur galeri belum aktif (misalnya di
     GitHub Pages sebelum Fase G6), yang tampil cukup foto arsip.
   - Upload (Fase G2): login Discord, foto dikecilkan & diubah ke WebP/JPG
     di browser, lalu dikirim ke antrean mod.
   - Keamanan: semua teks dari data dipasang lewat textContent (bukan
     innerHTML), jadi caption/nama berisi kode tidak akan dijalankan.
   ===================================================================== */
(function () {
  'use strict';

  // ====== DAFTAR FOTO ======
  // file: path dari akar situs (diawali galeri/), player: nick pemilik
  // (pisahkan dengan " & " kalau fotonya milik dua orang), caption: keterangan.
  var PHOTOS = [
    {file:'galeri/senja-bangunan-jepang.webp', player:'AyamKekar', caption:'sepertinya saya sudah muak dengan perkulian ini..'},
    {file:'galeri/lodge-salju.webp', player:'Gikx', caption:'New Empire'},
    {file:'galeri/foto-bareng-malam.webp', player:'AyamKekar', caption:'fotbar atmin dan anyak anyak'},
    {file:'galeri/balkon-bareng.webp', player:'Foksunee', caption:'p'},
    {file:'galeri/kumpul-salju.webp', player:'BlaZeSZ', caption:'saksi tragedi 17 september'},
    {file:'galeri/singgasana.webp', player:'Veneznia', caption:'Singgasana Veneznia'},
    {file:'galeri/santai-teras.webp', player:'BlaZeSZ', caption:'ilham ilmu hytam'},
    {file:'galeri/tavern-malam.webp', player:'BlaZeSZ', caption:'Onsen'},
    {file:'galeri/senjata-merah.webp', player:'Gikx', caption:'gede juga kapak gwehh'},
    {file:'galeri/pertarungan-gua.webp', player:'BlaZeSZ & Foksunee', caption:'blublub.. blubublubub!'},
    {file:'galeri/malam-hujan-portal.webp', player:'Gikx', caption:'3 portal di pulau Kepunyaan'},
    {file:'galeri/patung-batu.webp', player:'Veneznia', caption:'Urraa!'}
  ];
  var ROOT = '../'; // halaman ini ada di /galeri/, jadi path foto dihitung dari satu folder di atasnya
  // =========================

  // Dapur galeri cukup ditanya SEKALI. Kalau tidak menjawab (belum aktif), panggilan lain tidak dilakukan.
  var dapur = null;
  function cekDapur() { return dapur || (dapur = ambil('/api/saya')); }

  // Sumber data. Hasilnya selalu berbentuk: [{src, players:[nama...], caption}]
  function muat() {
    var arsip = PHOTOS.map(function (p) {
      return { src: ROOT + p.file, players: p.player.split(/\s*&\s*/), caption: p.caption || '' };
    });
    return cekDapur().then(function () { return ambil('/api/foto'); }).then(function (d) {
      return (d.foto || []).map(function (f) { return { src: f.src, players: [f.nick], caption: f.caption || '' }; }).concat(arsip);
    }, function () { return arsip; });
  }

  // Panggil dapur galeri. Gagal kalau dapur belum aktif (balasan bukan JSON) atau ada galat.
  function ambil(u, opsi) {
    opsi = opsi || {};
    var ctl = window.AbortController ? new AbortController() : null;
    var t = ctl && setTimeout(function () { ctl.abort(); }, opsi.method === 'POST' ? 90000 : 8000);
    return fetch(u, { method: opsi.method || 'GET', body: opsi.body, credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: ctl && ctl.signal })
      .then(function (r) {
        clearTimeout(t);
        if ((r.headers.get('Content-Type') || '').indexOf('application/json') < 0) throw new Error('Dapur galeri belum aktif.');
        return r.json().then(function (j) {
          if (!r.ok) { var e = new Error(j.galat || 'Terjadi kesalahan.'); e.status = r.status; throw e; }
          return j;
        });
      }, function (e) { clearTimeout(t); throw new Error(e && e.name === 'AbortError' ? 'Koneksi terlalu lama. Coba lagi.' : 'Tidak bisa terhubung. Cek koneksimu.'); });
  }

  var TONES = ['#b9cdf0', '#f9c8d5', '#d4c8f3', '#fbe3a0', '#c9e8c0', '#f3cdb8'];
  var TITLE = document.title;
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function tone(n) { var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return TONES[h % TONES.length]; }
  function href(n) { return n ? '?pemain=' + encodeURIComponent(n) : './'; }
  function label(p) { return (p.caption || 'Foto pemain') + ' - oleh ' + p.players.join(' & '); }
  function avatar(n, a) { a = a || el('span', 'pa'); a.textContent = (n.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase(); a.style.setProperty('--tone', tone(n)); a.setAttribute('aria-hidden', 'true'); return a; }
  function plain(e) { return !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button); } // klik biasa (bukan buka di tab baru)

  var all = [], shown = [], people = [], cur = 0, last = null;
  var page = document.querySelector('.page'), grid = $('grid'), empty = $('empty'), pl = $('pl'), prof = $('prof');
  var lb = $('lb'), lbm = $('lbm'), lbc = $('lbc'), lbi = $('lbi'), lbp = $('lbp'), lbnx = $('lbnx');

  function image(p, lazy) {
    var im = new Image();
    im.alt = label(p); im.decoding = 'async'; if (lazy) im.loading = 'lazy';
    im.onerror = function () { im.replaceWith(el('span', 'miss', 'Foto belum ditemukan')); };
    im.src = p.src;
    return im;
  }

  // "oleh A & B": tiap nama menjadi link ke profil pemain itu
  function byline(players, before) {
    var s = el('span');
    s.appendChild(document.createTextNode('oleh '));
    players.forEach(function (n, i) {
      if (i) s.appendChild(document.createTextNode(' & '));
      var a = el('a', null, n); a.href = href(n);
      a.addEventListener('click', function (e) { if (!plain(e)) return; e.preventDefault(); if (before) before(); go(n, true); });
      s.appendChild(a);
    });
    return s;
  }

  // ---------- Daftar pemain ----------
  function buildPeople() {
    var c = {};
    all.forEach(function (p) { p.players.forEach(function (n) { c[n] = (c[n] || 0) + 1; }); });
    people = Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); }).map(function (n) { return { name: n, count: c[n] }; });
    pl.textContent = '';
    [{ name: null, count: all.length }].concat(people).forEach(function (o) {
      var li = el('li'), a = el('a');
      a.href = href(o.name); a.dataset.name = o.name || '';
      if (o.name) a.appendChild(avatar(o.name)); else a.className = 'all';
      a.appendChild(document.createTextNode(o.name || 'Semua'));
      var c = el('small', null, String(o.count)); c.appendChild(el('span', 'sr', ' foto')); // "3 foto" untuk pembaca layar, yang tampil cukup "3"
      a.appendChild(c);
      a.addEventListener('click', function (e) { if (!plain(e)) return; e.preventDefault(); go(o.name, false); });
      li.appendChild(a); pl.appendChild(li);
    });
  }

  // Nama pemain dari alamat (?pemain=...). Nama yang tidak dikenal diabaikan.
  function fromUrl() {
    var q = new URLSearchParams(location.search).get('pemain');
    return people.some(function (o) { return o.name === q; }) ? q : null;
  }

  // ---------- Tampilkan feed (semua atau satu pemain) ----------
  function render(name) {
    [].forEach.call(pl.querySelectorAll('a'), function (a) {
      if (a.dataset.name === (name || '')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    prof.hidden = !name;
    if (name) {
      avatar(name, $('pa'));
      $('pn').textContent = name;
      $('pc').textContent = shownFor(name).length + ' foto di galeri';
    }
    shown = name ? shownFor(name) : all.slice();
    document.title = name ? 'Foto ' + name + ' - ' + TITLE : TITLE;

    grid.textContent = '';
    shown.forEach(function (p, i) {
      var card = el('article', 'gc'), b = el('button', 'gb'), t = el('div', 'gt');
      b.type = 'button'; b.appendChild(image(p, true));
      b.addEventListener('click', function () { openLb(i); });
      t.appendChild(el('b', null, p.caption || 'Foto pemain'));
      t.appendChild(byline(p.players));
      card.appendChild(b); card.appendChild(t); grid.appendChild(card);
    });
    empty.hidden = shown.length > 0;
  }
  function shownFor(n) { return all.filter(function (p) { return p.players.indexOf(n) > -1; }); }

  // Pindah tampilan + ubah alamat (bisa dibagikan, tombol Back tetap jalan)
  function go(name, focus) {
    if (history.pushState) history.pushState(null, '', href(name));
    render(name);
    var top = pl.getBoundingClientRect().top + window.scrollY - 12;
    if (window.scrollY > top) window.scrollTo({ top: top });
    if (focus && name) $('pn').focus({ preventScroll: true });
  }
  $('back').addEventListener('click', function (e) { if (!plain(e)) return; e.preventDefault(); go(null, false); });
  window.addEventListener('popstate', function () { closeLb(); render(fromUrl()); });

  // ---------- Lightbox ----------
  function show(i) {
    var n = shown.length; cur = (i + n) % n;
    var p = shown[cur];
    lbm.textContent = ''; lbm.appendChild(image(p, false));
    lbc.textContent = '';
    lbc.appendChild(el('b', null, p.caption || 'Foto pemain'));
    lbc.appendChild(byline(p.players, closeLb));
    lbi.textContent = n > 1 ? (cur + 1) + ' / ' + n : '';
    lbp.hidden = lbnx.hidden = n < 2;
    [cur + 1, cur - 1].forEach(function (k) { new Image().src = shown[(k + n) % n].src; }); // siapkan foto tetangga
  }
  function openLb(i) { last = document.activeElement; show(i); lb.hidden = false; page.inert = true; document.body.style.overflow = 'hidden'; $('lbx').focus(); }
  function closeLb() {
    if (lb.hidden) return;
    lb.hidden = true; page.inert = false; document.body.style.overflow = '';
    if (last && document.contains(last)) last.focus();
  }
  $('lbx').addEventListener('click', closeLb);
  lbp.addEventListener('click', function () { show(cur - 1); });
  lbnx.addEventListener('click', function () { show(cur + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    else if (e.key === 'ArrowLeft' && shown.length > 1) show(cur - 1);
    else if (e.key === 'ArrowRight' && shown.length > 1) show(cur + 1);
    else if (e.key === 'Tab') { // kunci fokus di dalam lightbox
      var f = [].filter.call(lb.querySelectorAll('button,a[href]'), function (x) { return !x.hidden; });
      var k = f.indexOf(document.activeElement);
      e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  // Geser (swipe) di HP: kiri = berikutnya, kanan = sebelumnya
  var sx = null;
  lb.addEventListener('touchstart', function (e) { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (sx === null || shown.length < 2) return;
    var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
  });

  // ---------- Upload (Fase G2) ----------
  var PESAN_LOGIN = {
    ok: 'Berhasil masuk. Sekarang kamu bisa upload foto.',
    batal: 'Login dibatalkan.',
    gagal: 'Login gagal. Coba lagi sebentar lagi.',
    'bukan-member': 'Akun Discord-mu belum gabung server ChaaTown. Gabung dulu lewat undangan, lalu coba masuk lagi.',
    diblokir: 'Akunmu tidak bisa upload ke galeri.',
    'belum-siap': 'Login Discord belum disiapkan oleh admin.'
  };
  var NICK = /^[A-Za-z0-9_.* ]{3,24}$/; // sama dengan aturan di dapur galeri
  var LABEL = { menunggu: 'Menunggu dicek', tayang: 'Tayang', ditolak: 'Ditolak' };
  var akun = null, siap = null, tsId = null, tsToken = null, tsMuat = null;
  var fFile = $('fu-file'), drop = $('drop'), pv = $('fu-pv'), btnKirim = $('fu-go');

  function info(teks, salah) { var i = $('up-info'); i.textContent = teks || ''; i.hidden = !teks; i.classList.toggle('salah', !!salah); }
  function galatForm(teks, fokus) { $('fu-err').textContent = teks || ''; if (fokus) fokus.focus(); }

  // Hasil login dikirim lewat alamat (?login=ok, dst.): tampilkan pesannya, lalu bersihkan alamat
  function cekLogin() {
    var q = new URLSearchParams(location.search), s = q.get('login');
    if (!s) return;
    info(PESAN_LOGIN[s] || PESAN_LOGIN.gagal, s !== 'ok');
    q.delete('login'); var sisa = q.toString();
    if (history.replaceState) history.replaceState(null, '', location.pathname + (sisa ? '?' + sisa : '') + location.hash);
  }

  function mulaiUpload() {
    cekDapur().then(function (s) { akun = s; $('up-statis').hidden = true; tampilAkun(); }, function () { /* dapur belum aktif: biarkan "Segera hadir" */ });
  }

  function tampilAkun() {
    $('up-masuk').hidden = akun.masuk; $('up-form').hidden = !akun.masuk;
    if (!akun.masuk) { $('up-uji').hidden = !akun.loginUji; return; }
    $('up-nama').textContent = akun.nama;
    var av = $('up-av'), pakai = /^\d{5,20}$/.test(akun.id) && /^(a_)?[0-9a-f]{32}$/.test(akun.avatar || '');
    if (pakai) av.src = 'https://cdn.discordapp.com/avatars/' + akun.id + '/' + akun.avatar + '.png?size=64';
    else avatar(akun.nama, $('up-pa'));
    av.hidden = !pakai; $('up-pa').hidden = pakai;
    var lm = $('up-mod'); lm.hidden = !akun.mod;
    if (akun.mod) lm.textContent = 'Halaman mod' + (akun.antreanMod ? ' (' + akun.antreanMod + ' menunggu)' : '');
    if (!$('fu-nick').value) { try { $('fu-nick').value = localStorage.getItem('chaatown-nick') || ''; } catch (e) {} }
    tampilKuota(); muatPunyaku(); siapkanTurnstile();
  }

  function tampilKuota() {
    var k = akun.kuota, sisa = Math.max(0, k.batasHarian - k.hariIni), penuh = k.antrean >= k.batasAntrean;
    $('fu-kuota').textContent = 'Sisa upload hari ini: ' + sisa + ' dari ' + k.batasHarian + '. Menunggu dicek mod: ' + k.antrean + ' dari ' + k.batasAntrean + '.';
    btnKirim.disabled = sisa === 0 || penuh;
  }

  function muatPunyaku() {
    ambil('/api/foto/saya').then(function (d) {
      var l = $('mine-l'); l.textContent = '';
      d.foto.forEach(function (f) {
        var li = el('li'), im, t = el('div'), s = el('span');
        if (f.src) { im = el('img'); im.src = f.src; im.alt = ''; im.loading = 'lazy'; }
        else im = el('span', 'kosong'); // foto ditolak: filenya sudah dihapus
        t.appendChild(el('b', null, f.caption || 'Tanpa caption'));
        s.appendChild(el('span', 'st st-' + f.status, LABEL[f.status] || f.status));
        s.appendChild(document.createTextNode(f.status === 'ditolak' && f.alasan ? 'Alasan: ' + f.alasan : 'sebagai ' + f.nick));
        t.appendChild(s); li.appendChild(im); li.appendChild(t); l.appendChild(li);
      });
      $('mine').hidden = !d.foto.length;
    }, function () {});
  }

  // Turnstile: pemeriksaan anti-bot dari Cloudflare (biasanya tanpa perlu klik apa pun)
  function siapkanTurnstile() {
    if (tsId !== null || !akun.turnstile) return;
    if (!tsMuat) tsMuat = new Promise(function (ok, gagal) {
      window.chaatownTs = ok;
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=chaatownTs';
      s.onerror = gagal; document.head.appendChild(s);
    });
    tsMuat.then(function () {
      var t = document.documentElement.getAttribute('data-theme');
      tsId = window.turnstile.render('#fu-ts', {
        sitekey: akun.turnstile, language: 'id', theme: t === 'dark' || t === 'light' ? t : 'auto',
        callback: function (k) { tsToken = k; }, 'expired-callback': function () { tsToken = null; }, 'error-callback': function () { tsToken = null; }
      });
    }, function () { galatForm('Verifikasi anti-bot tidak bisa dimuat. Cek koneksi atau matikan pemblokir iklan, lalu muat ulang halaman.'); });
  }
  function ulangTurnstile() { if (tsId !== null && window.turnstile) { window.turnstile.reset(tsId); tsToken = null; } }

  // Pilih / seret foto
  fFile.addEventListener('change', function () { if (fFile.files[0]) olahFile(fFile.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('seret'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('seret'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) olahFile(f); });
  $('fu-cap').addEventListener('input', function () { $('fu-hit').textContent = this.value.length + ' / 150'; });

  // Jenis file dilihat dari isinya (byte awal), bukan dari nama file
  function jenisAsli(f) {
    return f.slice(0, 12).arrayBuffer().then(function (ab) {
      var b = new Uint8Array(ab), s = function (a, z) { return String.fromCharCode.apply(null, b.subarray(a, z)); };
      if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
      if (b[0] === 0x89 && s(1, 4) === 'PNG') return 'png';
      if (s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return 'webp';
      return null;
    });
  }
  function bacaGambar(f) {
    return new Promise(function (ok, gagal) {
      var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () { ok(im); setTimeout(function () { URL.revokeObjectURL(u); }, 0); };
      im.onerror = function () { URL.revokeObjectURL(u); gagal(new Error('Foto tidak bisa dibaca. Mungkin filenya rusak.')); };
      im.src = u;
    });
  }
  function keBlob(c, jenis, q) { return new Promise(function (ok) { c.toBlob(ok, jenis, q); }); }

  // Gambar ulang di kanvas: sisi terpanjang maks 2560 px, jadi WebP (atau JPG di browser lama).
  // Bonus: metadata foto (lokasi GPS, info kamera) otomatis hilang.
  function kecilkan(im) {
    var maks = akun.ukuranMaks || 5242880;
    function coba(skala, q, n) {
      var c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * skala); c.height = Math.round(im.naturalHeight * skala);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      return keBlob(c, 'image/webp', q).then(function (b) {
        return b && b.type === 'image/webp' ? b : keBlob(c, 'image/jpeg', q);
      }).then(function (b) {
        if (!b) throw new Error('Browser-mu tidak bisa memproses foto ini.');
        if (b.size > maks) { if (n < 4) return coba(skala * 0.85, Math.max(0.6, q - 0.08), n + 1); throw new Error('Foto masih terlalu besar setelah dikecilkan.'); }
        return { blob: b, jenis: b.type === 'image/webp' ? 'webp' : 'jpg' };
      });
    }
    return coba(Math.min(1, 2560 / Math.max(im.naturalWidth, im.naturalHeight)), 0.86, 0);
  }

  function kosongkanFoto() { siap = null; if (pv.src) URL.revokeObjectURL(pv.src); pv.removeAttribute('src'); pv.hidden = true; $('drop-t').hidden = false; }
  function olahFile(f) {
    galatForm(''); kosongkanFoto();
    if (f.size > 25 * 1048576) { fFile.value = ''; return galatForm('File terlalu besar (maksimal 25 MB).'); }
    jenisAsli(f).then(function (j) {
      if (!j) throw new Error('Format tidak didukung. Pakai foto JPG, PNG, atau WebP.');
      return bacaGambar(f);
    }).then(function (im) {
      if (im.naturalWidth < 200 || im.naturalHeight < 200) throw new Error('Foto terlalu kecil (minimal 200 piksel per sisi).');
      return kecilkan(im);
    }).then(function (h) {
      siap = h; pv.src = URL.createObjectURL(h.blob); pv.hidden = false; $('drop-t').hidden = true;
    }).catch(function (e) { fFile.value = ''; galatForm(e.message || 'Foto tidak bisa dibaca.'); });
  }

  $('fu').addEventListener('submit', function (e) {
    e.preventDefault(); galatForm(''); info('');
    var nick = $('fu-nick').value.trim().replace(/\s+/g, ' ');
    if (!siap) return galatForm('Pilih foto dulu.', fFile);
    if (!NICK.test(nick)) return galatForm('Isi nickname Minecraft-mu (3 sampai 24 karakter: huruf, angka, _).', $('fu-nick'));
    if (!tsToken) return galatForm('Tunggu verifikasi anti-bot selesai dulu, ya.');
    var fd = new FormData();
    fd.append('foto', siap.blob, 'foto.' + siap.jenis);
    fd.append('nick', nick);
    fd.append('caption', $('fu-cap').value);
    fd.append('cf-turnstile-response', tsToken);
    btnKirim.disabled = true; btnKirim.textContent = 'Mengirim...';
    ambil('/api/foto', { method: 'POST', body: fd }).then(function () {
      try { localStorage.setItem('chaatown-nick', nick); } catch (x) {}
      $('fu').reset(); $('fu-nick').value = nick; $('fu-hit').textContent = '0 / 150'; fFile.value = ''; kosongkanFoto();
      info('Fotomu masuk antrean! Mod bakal ngecek dulu sebelum tampil di galeri.');
      muatPunyaku();
    }, function (x) {
      galatForm(x.message || 'Upload gagal. Coba lagi.');
    }).then(function () { return ambil('/api/saya').then(function (s) { akun = s; }, function () {}); })
      .then(function () { btnKirim.textContent = 'Kirim ke antrean'; ulangTurnstile(); if (akun.masuk) tampilKuota(); else tampilAkun(); });
  });

  $('up-keluar').addEventListener('click', function () {
    ambil('/api/auth/keluar', { method: 'POST' }).then(function () {
      akun.masuk = false; info('Kamu sudah keluar.'); tampilAkun();
    }, function (x) { info(x.message, true); });
  });

  // ---------- Mulai ----------
  cekLogin();
  mulaiUpload();
  muat().then(function (data) {
    all = data;
    buildPeople();
    render(fromUrl());
  });
})();
