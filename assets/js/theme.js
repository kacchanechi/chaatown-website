/* =====================================================================
   ChaaTown - theme.js (semua halaman)
   Tombol ganti tema terang <-> gelap.
   - Awalnya situs mengikuti pengaturan perangkat (prefers-color-scheme).
   - Begitu tombol diklik, pilihan disimpan di browser (localStorage) dan
     dipakai di semua halaman, juga saat dibuka lagi nanti.
   - WAJIB dimuat di <head> SEBELUM CSS (tanpa defer/async), supaya tema
     terpasang sebelum halaman tampil: tidak ada kedip terang -> gelap.
   Warna tiap tema ada di base.css & glass.css (:root[data-theme="..."]).
   ===================================================================== */
(function () {
  var KEY = 'chaatown-tema', root = document.documentElement;
  var BAR = { light: '#f2f6fd', dark: '#232a4d' }; // warna bilah browser di HP (sama dengan --bg)
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  // localStorage bisa diblokir (mode privat, pengaturan browser): tombol tetap jalan, hanya tidak diingat.
  function load() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(t) { try { localStorage.setItem(KEY, t); } catch (e) {} }

  function apply(t) { if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); }
  function current() { return root.getAttribute('data-theme') || (mq && mq.matches ? 'dark' : 'light'); }

  // Samakan warna bilah browser & label tombol dengan tema yang sedang tampil.
  function sync() {
    var forced = root.getAttribute('data-theme');
    [].forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) {
      var asli = /dark/.test(m.getAttribute('media') || '') ? BAR.dark : BAR.light;
      m.setAttribute('content', forced ? BAR[forced] : asli);
    });
    var b = document.getElementById('tema');
    if (b) {
      var label = current() === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap';
      b.setAttribute('aria-label', label); b.title = label;
    }
  }

  apply(load());
  sync();

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('tema');
    if (b) b.addEventListener('click', function () {
      var t = current() === 'dark' ? 'light' : 'dark';
      apply(t); save(t); sync();
    });
    sync();
  });

  // Pengaturan perangkat berubah (misalnya HP otomatis gelap di malam hari): label ikut menyesuaikan.
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', sync); else if (mq.addListener) mq.addListener(sync); }

  // Tema diganti di tab lain: tab ini ikut berganti.
  window.addEventListener('storage', function (e) { if (e.key === KEY) { apply(e.newValue); sync(); } });
})();
