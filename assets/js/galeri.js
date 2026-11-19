/* =====================================================================
   ChaaTown - galeri.js (khusus galeri/index.html)
   - Feed foto, profil per pemain (alamat ?pemain=Nama), dan lightbox.
   - Fase G1: daftar foto masih ditulis di file ini (PHOTOS di bawah).
   - Fase G2: isi fungsi muat() diganti supaya mengambil foto yang sudah
     disetujui mod dari /api/foto. Bagian tampilan tidak perlu diubah.
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

  // Sumber data. Hasilnya selalu berbentuk: [{src, players:[nama...], caption}]
  function muat() {
    return Promise.resolve(PHOTOS.map(function (p) {
      return { src: ROOT + p.file, players: p.player.split(/\s*&\s*/), caption: p.caption || '' };
    }));
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

  // ---------- Mulai ----------
  muat().then(function (data) {
    all = data;
    buildPeople();
    render(fromUrl());
  });
})();
