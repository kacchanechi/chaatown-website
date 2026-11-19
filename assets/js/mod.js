/* =====================================================================
   ChaaTown - mod.js (khusus galeri/mod/index.html: Moderasi Galeri)
   - Hanya untuk akun Discord yang punya role mod. Semua pengecekan hak
     akses tetap dilakukan dapur galeri; halaman ini hanya tampilannya.
   - Semua teks dari pengupload dipasang lewat textContent (aman dari kode).
   ===================================================================== */
(function () {
  'use strict';

  var ALASAN = [
    'Bukan screenshot Minecraft ChaaTown',
    'Konten tidak pantas',
    'Foto buram atau kualitas rendah',
    'Foto sama dengan yang sudah ada',
    'Berisi info pribadi (wajah asli, alamat, kontak)',
    'Lainnya'
  ];
  var AKSI = {
    setujui: 'menyetujui foto', tolak: 'menolak foto', turunkan: 'menurunkan foto', blokir: 'memblokir akun', 'buka-blokir': 'membuka blokir akun',
    'sembunyikan-komentar': 'menyembunyikan komentar', 'abaikan-laporan': 'mengabaikan laporan', 'lepas-nick': 'melepas nickname'
  };
  var KOSONG = {
    menunggu: 'Antrean kosong. Semua foto sudah dicek.', laporan: 'Tidak ada laporan terbuka.', tayang: 'Belum ada foto upload yang tayang.',
    ditolak: 'Belum ada foto yang ditolak.', diblokir: 'Tidak ada akun yang diblokir.', nick: 'Belum ada nickname yang dimiliki.', riwayat: 'Belum ada tindakan mod.'
  };
  var TAB = ['menunggu', 'laporan', 'tayang', 'ditolak', 'diblokir', 'nick', 'riwayat'];
  var PESAN_LOGIN = { batal: 'Login dibatalkan.', gagal: 'Login gagal. Coba lagi sebentar lagi.', 'bukan-member': 'Akun Discord-mu belum gabung server ChaaTown.', diblokir: 'Akun ini diblokir.', 'belum-siap': 'Login Discord belum disiapkan oleh admin.' };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function info(teks, salah) { var i = $('info'); i.textContent = teks || ''; i.hidden = !teks; i.classList.toggle('salah', !!salah); }
  function relatif(t) {
    var d = Math.max(0, Math.floor(Date.now() / 1000) - t);
    if (d < 60) return 'baru saja';
    if (d < 3600) return Math.floor(d / 60) + ' menit lalu';
    if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
    if (d < 86400 * 30) return Math.floor(d / 86400) + ' hari lalu';
    return new Date(t * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function kb(n) { return n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }

  // Panggil dapur galeri (sama seperti di galeri.js, ditambah kiriman JSON)
  function ambil(u, data) {
    var o = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (data) { o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(data); }
    return fetch(u, o).then(function (r) {
      if ((r.headers.get('Content-Type') || '').indexOf('application/json') < 0) throw new Error('Dapur galeri belum aktif.');
      return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.galat || 'Terjadi kesalahan.'); e.status = r.status; throw e; } return j; });
    }, function () { throw new Error('Tidak bisa terhubung. Cek koneksimu.'); });
  }

  function tampil(id) { ['st-muat', 'st-mati', 'st-masuk', 'st-bukan', 'st-mod'].forEach(function (k) { $(k).hidden = k !== id; }); }

  // ---------- Tab ----------
  var tabs = [].slice.call(document.querySelectorAll('.mtabs [role=tab]')), panel = $('panel'), aktif = null, urutan = 0;
  function buka(k, fokus) {
    aktif = k;
    tabs.forEach(function (t) { var on = t.dataset.k === k; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && fokus) t.focus(); });
    panel.setAttribute('aria-labelledby', 't-' + k);
    if (history.replaceState) history.replaceState(null, '', '#' + k);
    muat();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { info(''); buka(t.dataset.k, false); });
    t.addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : null;
      if (n !== null) { e.preventDefault(); buka(tabs[n].dataset.k, true); }
    });
  });
  function angka(j) { ['menunggu', 'laporan', 'tayang', 'ditolak', 'diblokir'].forEach(function (k) { $('n-' + k).textContent = j && j[k] ? j[k] : ''; }); }
  function segarkanAngka() { ambil('/api/mod/pengguna').then(function (d) { angka(d.jumlah); }, function () {}); }

  function muat() {
    var k = aktif, ke = ++urutan;
    panel.textContent = ''; panel.appendChild(el('p', 'lead', 'Memuat...'));
    var u = { diblokir: '/api/mod/pengguna', riwayat: '/api/mod/riwayat', laporan: '/api/mod/laporan', nick: '/api/mod/nick' }[k] || '/api/mod/foto?status=' + k;
    ambil(u).then(function (d) {
      if (ke !== urutan) return; // sudah pindah tab
      angka(d.jumlah); panel.textContent = '';
      var isi = { diblokir: d.pengguna, riwayat: d.riwayat, laporan: d.laporan, nick: d.nick }[k] || d.foto;
      if (!isi.length) { panel.appendChild(el('p', 'kosong-p', KOSONG[k])); return; }
      if (k === 'diblokir') panel.appendChild(daftarBlokir(isi));
      else if (k === 'riwayat') panel.appendChild(daftarRiwayat(isi));
      else if (k === 'laporan') isi.forEach(function (l) { panel.appendChild(kartuLaporan(l)); });
      else if (k === 'nick') panel.appendChild(daftarNick(isi));
      else isi.forEach(function (f) { panel.appendChild(kartu(f)); });
    }, function (e) {
      if (ke !== urutan) return;
      if (e.status === 403 || e.status === 401) { tampil('st-masuk'); info('Sesi mod sudah habis. Masuk lagi, ya.', true); return; }
      panel.textContent = ''; panel.appendChild(el('p', 'kosong-p', e.message));
    });
  }

  // Hapus satu kartu/baris setelah ditindak, lalu pindahkan fokus ke yang berikutnya
  function selesai(item, pesan) {
    var lanjut = item.nextElementSibling || item.previousElementSibling, induk = item.parentNode;
    item.remove(); info(pesan); segarkanAngka();
    if (lanjut) { var b = lanjut.querySelector('button'); (b || panel).focus(); }
    else { if (induk !== panel && induk) induk.remove(); panel.appendChild(el('p', 'kosong-p', KOSONG[aktif])); panel.focus(); }
  }
  function tombol(teks, cls, fn) { var b = el('button', 'btn ' + (cls || ''), teks); b.type = 'button'; b.addEventListener('click', fn); return b; }

  // ---------- Kartu foto ----------
  var nomor = 0;
  function kartu(f) {
    var id = 'k' + (++nomor), a = el('article', 'mk'), g, b = el('div'), err = el('p', 'err');
    err.setAttribute('role', 'alert');
    if (f.src) {
      g = el('a', 'mk-g'); g.href = f.src; g.target = '_blank'; g.rel = 'noopener';
      var im = el('img'); im.src = f.src; im.loading = 'lazy'; im.alt = 'Buka ukuran penuh: foto dari ' + f.nick;
      g.appendChild(im);
    } else g = el('div', 'mk-g kosong', 'File foto sudah dihapus');

    b.appendChild(el('h2', null, f.caption || 'Tanpa caption'));
    var dl = el('dl', 'mk-m');
    function baris(dt, dd) { dl.appendChild(el('dt', null, dt)); dl.appendChild(el('dd', null, dd)); }
    baris('Nick MC', f.nick);
    baris('Akun Discord', f.pengguna.nama + ' (ID ' + f.pengguna.id + ')' + (f.pengguna.diblokir ? ', diblokir' : ''));
    baris('Ukuran', f.lebar + ' × ' + f.tinggi + ' px, ' + kb(f.ukuran));
    baris('Dikirim', relatif(f.dibuat));
    if (f.status !== 'menunggu' && f.dicekPada) baris(f.status === 'tayang' ? 'Disetujui' : 'Ditolak', (f.dicekOleh || 'mod') + ', ' + relatif(f.dicekPada));
    if (f.alasan) baris('Alasan', f.alasan);
    b.appendChild(dl);

    if (f.status !== 'ditolak') {
      var aksi = el('div', 'ract'), fTolak = formTolak(f, a, id, err), fBlokir = formBlokir(f, a, id, err);
      function alih(form) { [fTolak, fBlokir].forEach(function (x) { x.hidden = x !== form || !x.hidden; }); if (!form.hidden) form.querySelector('select,input').focus(); }
      if (f.status === 'menunggu') aksi.appendChild(tombol('Setujui', '', function () {
        var t = this; t.disabled = true; err.textContent = '';
        ambil('/api/mod/foto', { id: f.id, aksi: 'setujui' }).then(function () { selesai(a, 'Foto "' + (f.caption || f.nick) + '" disetujui dan sudah tayang di galeri.'); },
          function (e) { t.disabled = false; err.textContent = e.message; });
      }));
      aksi.appendChild(tombol(f.status === 'tayang' ? 'Turunkan...' : 'Tolak...', 'merah', function () { alih(fTolak); }));
      if (!f.pengguna.diblokir) aksi.appendChild(tombol('Blokir pengupload...', 'o', function () { alih(fBlokir); }));
      b.appendChild(aksi); b.appendChild(fTolak); b.appendChild(fBlokir);
    }
    b.appendChild(err);
    a.appendChild(g); a.appendChild(b);
    return a;
  }

  function formTolak(f, kartuEl, id, err) {
    var d = el('div', 'mk-f'), lbl = el('label', null, 'Alasan'), sel = el('select'), lblL = el('label', null, 'Tulis alasannya'), inp = el('input');
    d.hidden = true;
    sel.id = id + '-al'; lbl.htmlFor = sel.id;
    ALASAN.forEach(function (x) { sel.appendChild(el('option', null, x)); });
    inp.id = id + '-tl'; lblL.htmlFor = inp.id; inp.type = 'text'; inp.maxLength = 150;
    lblL.hidden = inp.hidden = true;
    sel.addEventListener('change', function () { lblL.hidden = inp.hidden = sel.value !== 'Lainnya'; err.textContent = ''; if (!inp.hidden) inp.focus(); });
    inp.addEventListener('input', function () { err.textContent = ''; });
    var p = el('p', null, f.status === 'tayang'
      ? 'Foto akan hilang dari galeri dan filenya dihapus. Pemiliknya bisa melihat alasannya di "Fotoku".'
      : 'Filenya akan dihapus. Pemiliknya bisa melihat alasannya di "Fotoku".');
    var aksi = el('div', 'ract');
    aksi.appendChild(tombol(f.status === 'tayang' ? 'Turunkan foto' : 'Tolak foto', 'merah', function () {
      var alasan = sel.value === 'Lainnya' ? inp.value.trim() : sel.value, t = this;
      if (alasan.length < 3) { err.textContent = 'Tulis alasannya dulu.'; inp.focus(); return; }
      t.disabled = true; err.textContent = '';
      ambil('/api/mod/foto', { id: f.id, aksi: 'tolak', alasan: alasan }).then(function () {
        selesai(kartuEl, 'Foto "' + (f.caption || f.nick) + '" ' + (f.status === 'tayang' ? 'diturunkan.' : 'ditolak.'));
      }, function (e) { t.disabled = false; err.textContent = e.message; });
    }));
    aksi.appendChild(tombol('Batal', 'o', function () { d.hidden = true; kartuEl.querySelector('.ract .btn').focus(); }));
    [lbl, sel, lblL, inp, p, aksi].forEach(function (x) { d.appendChild(x); });
    return d;
  }

  function formBlokir(f, kartuEl, id, err) {
    var d = el('div', 'mk-f'), lbl = el('label', null, 'Alasan blokir'), inp = el('input');
    d.hidden = true;
    inp.id = id + '-bl'; lbl.htmlFor = inp.id; inp.type = 'text'; inp.maxLength = 150;
    inp.addEventListener('input', function () { err.textContent = ''; });
    var p = el('p', null, 'Akun ' + f.pengguna.nama + ' tidak akan bisa masuk dan upload lagi, dan semua fotonya yang masih menunggu ikut ditolak. Foto yang sudah tayang tidak ikut turun.');
    var aksi = el('div', 'ract');
    aksi.appendChild(tombol('Ya, blokir', 'merah', function () {
      var t = this;
      if (inp.value.trim().length < 3) { err.textContent = 'Tulis alasan pemblokirannya dulu.'; inp.focus(); return; }
      t.disabled = true; err.textContent = '';
      ambil('/api/mod/pengguna', { id: f.pengguna.id, blokir: true, alasan: inp.value.trim() }).then(function (r) {
        info('Akun ' + f.pengguna.nama + ' diblokir.' + (r.fotoDitolak ? ' ' + r.fotoDitolak + ' fotonya yang menunggu ikut ditolak.' : ''));
        muat(); panel.focus();
      }, function (e) { t.disabled = false; err.textContent = e.message; });
    }));
    aksi.appendChild(tombol('Batal', 'o', function () { d.hidden = true; kartuEl.querySelector('.ract .btn').focus(); }));
    [lbl, inp, p, aksi].forEach(function (x) { d.appendChild(x); });
    return d;
  }

  // ---------- Akun diblokir ----------
  function daftarBlokir(list) {
    var ul = el('ul', 'ul');
    list.forEach(function (p) {
      var li = el('li'), d = el('div');
      d.appendChild(el('b', null, p.nama));
      d.appendChild(el('small', null, 'ID ' + p.id + (p.alasan ? ' · Alasan: ' + p.alasan : '')));
      li.appendChild(d);
      li.appendChild(tombol('Buka blokir', 'o kecil', function () {
        var t = this; t.disabled = true;
        ambil('/api/mod/pengguna', { id: p.id, blokir: false }).then(function () { selesai(li, 'Blokir akun ' + p.nama + ' sudah dibuka.'); },
          function (e) { t.disabled = false; info(e.message, true); });
      }));
      ul.appendChild(li);
    });
    return ul;
  }

  // ---------- Laporan dari pemain (Fase G4) ----------
  function kartuLaporan(l) {
    var a = el('article', 'mk'), b = el('div'), err = el('p', 'err'), id = 'l' + (++nomor), g;
    err.setAttribute('role', 'alert');
    var src = l.foto ? l.foto.src : l.komentar.foto.src;
    if (src) {
      g = el('a', 'mk-g'); g.href = src; g.target = '_blank'; g.rel = 'noopener';
      var im = el('img'); im.src = src; im.loading = 'lazy'; im.alt = l.foto ? 'Buka foto yang dilaporkan' : 'Buka foto tempat komentar ini'; g.appendChild(im);
    } else g = el('div', 'mk-g kosong', 'File foto sudah dihapus');

    var judul = el('h2');
    judul.appendChild(el('span', 'rw-a ' + (l.foto ? 'turunkan' : 'tolak'), l.foto ? 'foto' : 'komentar'));
    judul.appendChild(document.createTextNode(' Dilaporkan ' + l.jumlah + ' akun'));
    b.appendChild(judul);
    if (l.komentar) {
      var q = el('blockquote', 'kutip', l.komentar.isi); b.appendChild(q);
    }
    var dl = el('dl', 'mk-m');
    function baris(dt, dd) { dl.appendChild(el('dt', null, dt)); dl.appendChild(el('dd', null, dd)); }
    if (l.foto) { baris('Caption', l.foto.caption || 'Tanpa caption'); baris('Nick MC', l.foto.nick); }
    else { baris('Di foto', l.komentar.foto.caption || 'Tanpa caption'); if (l.komentar.status !== 'tampil') baris('Status', 'Disembunyikan' + (l.komentar.alasan ? ' (' + l.komentar.alasan + ')' : '')); }
    baris(l.foto ? 'Pemilik' : 'Penulis', l.pemilik.nama + ' (ID ' + l.pemilik.id + ')');
    baris('Alasan laporan', l.alasan.join(' · '));
    baris('Laporan pertama', relatif(l.pertama));
    b.appendChild(dl);

    var aksi = el('div', 'ract'), f = el('div', 'mk-f'), lbl = el('label', null, 'Alasan'), inp = el('input');
    f.hidden = true; inp.id = id + '-a'; lbl.htmlFor = inp.id; inp.type = 'text'; inp.maxLength = 150;
    inp.value = l.alasan[0] || '';
    inp.addEventListener('input', function () { err.textContent = ''; });
    var teksTindak = l.foto ? 'Turunkan foto' : 'Sembunyikan komentar';
    function kirim(aksiNya, tombolNya) {
      var alasan = inp.value.trim();
      if (aksiNya === 'tindak' && alasan.length < 3) { err.textContent = 'Tulis alasannya dulu.'; inp.focus(); return; }
      tombolNya.disabled = true; err.textContent = '';
      ambil('/api/mod/laporan', { jenis: l.jenis, id: l.id, aksi: aksiNya, alasan: alasan }).then(function () {
        selesai(a, aksiNya === 'abaikan' ? 'Laporan diabaikan.' + (l.komentar && l.komentar.status !== 'tampil' ? ' Komentarnya muncul lagi.' : '') : (l.foto ? 'Foto diturunkan.' : 'Komentar disembunyikan.'));
      }, function (e) { tombolNya.disabled = false; err.textContent = e.message; });
    }
    aksi.appendChild(tombol(teksTindak + '...', 'merah', function () { f.hidden = !f.hidden; if (!f.hidden) inp.focus(); }));
    aksi.appendChild(tombol('Abaikan laporan', 'o', function () { kirim('abaikan', this); }));
    var konfirmasi = el('div', 'ract');
    konfirmasi.appendChild(tombol(teksTindak, 'merah', function () { kirim('tindak', this); }));
    konfirmasi.appendChild(tombol('Batal', 'o', function () { f.hidden = true; aksi.querySelector('.btn').focus(); }));
    [lbl, inp, konfirmasi].forEach(function (x) { f.appendChild(x); });
    b.appendChild(aksi); b.appendChild(f); b.appendChild(err);
    a.appendChild(g); a.appendChild(b);
    return a;
  }

  // ---------- Nickname (Fase G4) ----------
  function daftarNick(list) {
    var ul = el('ul', 'ul');
    list.forEach(function (n) {
      var li = el('li'), d = el('div');
      d.appendChild(el('b', null, n.tampil));
      d.appendChild(el('small', null, n.pemilik ? 'Milik ' + n.pemilik.nama + ' (ID ' + n.pemilik.id + ')' + (n.dibuat ? ' · sejak ' + relatif(n.dibuat) : '') : 'Dipesan untuk pemilik foto arsip'));
      li.appendChild(d);
      var wadah = el('div', 'ract');
      wadah.appendChild(tombol('Lepas', 'o kecil', function () {
        var t = this; wadah.textContent = '';
        wadah.appendChild(el('span', 'tanya', 'Lepas nickname ini? Akun berikutnya yang memakainya akan jadi pemiliknya.'));
        wadah.appendChild(tombol('Ya, lepas', 'merah kecil', function () {
          var y = this; y.disabled = true;
          ambil('/api/mod/nick', { nick: n.nick, aksi: 'lepas' }).then(function () { selesai(li, 'Nickname ' + n.tampil + ' sudah dilepas.'); },
            function (e) { y.disabled = false; info(e.message, true); });
        }));
        wadah.appendChild(tombol('Batal', 'o kecil', function () { muat(); }));
        wadah.querySelector('.merah').focus();
      }));
      li.appendChild(wadah);
      ul.appendChild(li);
    });
    return ul;
  }

  // ---------- Riwayat ----------
  function daftarRiwayat(list) {
    var ul = el('ul', 'ul');
    list.forEach(function (r) {
      var li = el('li'), d = el('div'), baris = el('span');
      baris.appendChild(el('span', 'rw-a ' + r.aksi, r.aksi.replace('-', ' ')));
      var akun = r.aksi.indexOf('blokir') > -1; // "memblokir akun X" vs "menyetujui foto milik X"
      baris.appendChild(document.createTextNode(r.mod_nama + ' ' + (AKSI[r.aksi] || r.aksi) + (r.pengguna_nama ? (akun ? ' ' : ' milik ') + r.pengguna_nama : '')));
      d.appendChild(baris);
      d.appendChild(el('small', null, relatif(r.waktu) + (r.alasan ? ' · Alasan: ' + r.alasan : '') + (r.foto_id ? ' · Foto ' + r.foto_id.slice(0, 8) : '')));
      li.appendChild(d); ul.appendChild(li);
    });
    return ul;
  }

  // ---------- Masuk / keluar ----------
  var loginUji = false;
  function keluar() { ambil('/api/auth/keluar', {}).then(function () { info('Kamu sudah keluar.'); $('uji').hidden = !loginUji; tampil('st-masuk'); }, function (e) { info(e.message, true); }); }
  $('keluar').addEventListener('click', keluar);
  $('keluar-b').addEventListener('click', keluar);

  var q = new URLSearchParams(location.search), hasil = q.get('login');
  if (hasil) {
    if (hasil !== 'ok') info(PESAN_LOGIN[hasil] || PESAN_LOGIN.gagal, true);
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.hash);
  }
  ambil('/api/saya').then(function (s) {
    loginUji = !!s.loginUji;
    if (!s.masuk) { $('uji').hidden = !loginUji; tampil('st-masuk'); return; }
    if (!s.mod) { $('nama-b').textContent = s.nama; tampil('st-bukan'); return; }
    $('nama').textContent = s.nama; tampil('st-mod');
    buka(dariAlamat() || 'menunggu', false);
    // Alamat diganti tanpa muat ulang (misalnya link ke #ditolak): ikut pindah tab
    window.addEventListener('hashchange', function () { var k = dariAlamat(); if (k && k !== aktif) buka(k, false); });
  }, function () { tampil('st-mati'); });
  function dariAlamat() { var h = location.hash.slice(1); return TAB.indexOf(h) > -1 ? h : null; }
})();
