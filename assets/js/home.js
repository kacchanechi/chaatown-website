/* =====================================================================
   ChaaTown - home.js (khusus index.html)
   Butuh: config.js dan common.js dimuat lebih dulu.
   ===================================================================== */

/* ---------- Skyline kota & tombol salin ---------- */
(function () {
  ChaaTown.skyline(document.getElementById('sky'), 7, true);

  // Tombol "Salin IP server" di hero
  document.getElementById('copy').addEventListener('click', function () {
    var ip = document.getElementById('ip').textContent;
    ChaaTown.copy(ip, 'IP tersalin', ip);
  });

  // Tombol "Salin" kecil di tab Cara Gabung (nilai diambil dari atribut data-copy)
  [].forEach.call(document.querySelectorAll('[data-copy]'), function (b) {
    b.addEventListener('click', function () {
      var v = b.dataset.copy;
      ChaaTown.copy(v, 'Tersalin: ' + v, v);
    });
  });
})();

/* ---------- Tab halaman (Fitur, Cara Gabung, Guide, Top Up, Bantuan) ---------- */
(function () {
  var tabs = [].slice.call(document.querySelectorAll('.tabs [role=tab]')), ids = tabs.map(function (t) { return t.dataset.tab; });
  function open(id, focus, scroll) {
    tabs.forEach(function (t) { var on = t.dataset.tab === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    ids.forEach(function (k) { document.getElementById('p-' + k).hidden = (k !== id); });
    if (scroll) { var hh = document.querySelector('.hero').offsetHeight; if (window.scrollY > hh) window.scrollTo({ top: hh }); }
    // alamat ikut berubah supaya tab bisa dibagikan; replaceState: tidak menambah riwayat tombol Back
    if (history.replaceState) history.replaceState(null, '', id === ids[0] ? location.pathname + location.search : '#' + id);
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { open(t.dataset.tab, false, true); });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); open(ids[n], true, false); }
    });
  });
  // Buka tab dari alamat, misalnya chaatown.my.id/#guide (saat dibuka & saat alamat diganti)
  function fromHash() { var h = location.hash.slice(1); if (ids.indexOf(h) > -1) open(h, false, false); }
  fromHash(); window.addEventListener('hashchange', fromHash);
})();

/* ---------- Sub-tab (Top Up & Guide) ---------- */
(function () {
  [].forEach.call(document.querySelectorAll('.subtabs'), function (group) {
    var st = [].slice.call(group.querySelectorAll('[role=tab]'));
    function open(k, focus) {
      st.forEach(function (t) {
        var on = t.dataset.sub === k;
        t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        if (on && focus) t.focus();
      });
    }
    st.forEach(function (t, i) {
      t.addEventListener('click', function () { open(t.dataset.sub, false); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % st.length;
        else if (e.key === 'ArrowLeft') n = (i - 1 + st.length) % st.length;
        if (n !== null) { e.preventDefault(); open(st[n].dataset.sub, true); }
      });
    });
  });
})();

/* ---------- Form pembelian Rank VIP & Paw Coin ----------
   Saat ini form belum ada di HTML (tab Top Up berisi "Segera hadir"), jadi bagian ini
   tidak melakukan apa-apa. Begitu form dengan id fr-* / fp-* ditambahkan lagi,
   semuanya langsung berfungsi. Data rank & paket ada di config.js. */
(function () {
  function el(i) { return document.getElementById(i); }
  function rp(n) { return 'Rp ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  var RANKS = window.CHAATOWN.RANKS, PACKS = window.CHAATOWN.PACKS;
  function setup(id, items, label, build) {
    var sel = el(id + '-sel'), nick = el(id + '-nick'), err = el(id + '-err'), res = el(id + '-res');
    items.forEach(function (it, i) { var o = document.createElement('option'); o.value = i; o.textContent = label(it); sel.appendChild(o); });
    function reset() { res.hidden = true; err.textContent = ''; }
    sel.addEventListener('change', reset); nick.addEventListener('input', reset);
    el(id + '-go').addEventListener('click', function () {
      err.textContent = '';
      var v = sel.value, n = nick.value.trim();
      if (v === '') { err.textContent = 'Pilih dulu yang mau dibeli.'; sel.focus(); return; }
      if (n.length<3||n.length>24) { err.textContent = 'Isi nickname Minecraft-mu (3 sampai 24 karakter).'; nick.focus(); return; }
      var it = items[+v];
      el(id + '-msg').textContent = build(it, n);
      el(id + '-amt').textContent = rp(it.price);
      res.hidden = false;
    });
    el(id + '-copy').addEventListener('click', function () {
      ChaaTown.copy(el(id + '-msg').textContent, 'Pesan tersalin', 'Salin manual dari kotak pesan');
    });
    return function (i) { sel.value = i; reset(); var f = el(id); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); nick.focus({ preventScroll: true }); };
  }
  var pickR = el('fr') && setup('fr', RANKS, function (r) { return r.name + ' - ' + rp(r.price); }, function (r, n) { return 'Beli rank '+r.name+' | Nickname: '+n; });
  var pickP = el('fp') && setup('fp', PACKS, function (p) { return p.name + ' (' + p.amt + ' Paw Coins) - ' + rp(p.price); }, function (p, n) { return 'Beli '+p.name+' ('+p.amt+' Paw Coins) | Nickname: '+n; });
  [].forEach.call(document.querySelectorAll('[data-rank]'), function (b) { b.addEventListener('click', function () { pickR(+b.dataset.rank); }); });
  [].forEach.call(document.querySelectorAll('[data-pack]'), function (b) { b.addEventListener('click', function () { pickP(+b.dataset.pack); }); });
})();
