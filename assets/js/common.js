/* =====================================================================
   ChaaTown - common.js
   Fungsi bersama: toast, salin ke clipboard, skyline pixel kota.
   Dipakai lewat objek global ChaaTown (misalnya ChaaTown.toast('Halo')).
   ===================================================================== */
window.ChaaTown = (function () {
  var timer = null;

  // Tampilkan notifikasi kecil di bawah layar selama 1,8 detik.
  // Timer lama dibatalkan dulu, jadi klik berulang tidak membuat toast hilang terlalu cepat.
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(timer);
    timer = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }

  // Salin teks ke clipboard. Berhasil -> toast okMsg, gagal -> toast failMsg.
  function copy(text, okMsg, failMsg) {
    try {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, function () { toast(failMsg); });
    } catch (e) { toast(failMsg); }
  }

  // Gambar skyline pixel kota (grid 64x16) ke dalam <svg>. Hasilnya selalu sama untuk seed yang sama.
  // blink=true: sebagian jendela diberi class "win" (berkedip), dipakai di halaman utama.
  function skyline(svg, seed, blink) {
    if (!svg) return;
    var h = '', x = 0;
    function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    while (x < 64) {
      var w = 3 + Math.floor(r() * 4), ht = 4 + Math.floor(r() * 9);
      if (x + w > 64) w = 64 - x;
      var top = 16 - ht;
      h += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + ht + '" fill="var(--bld)" opacity="' + (0.82 + r() * 0.18).toFixed(2) + '"/>';
      for (var wy = top + 1; wy < 15; wy += 2) {
        for (var wx = x + 1; wx < x + w; wx += 2) {
          if (r() > .45) {
            h += blink
              ? '<rect class="' + (r() > .8 ? 'win' : '') + '" x="' + wx + '" y="' + wy + '" width="1" height="1" fill="var(--win)"/>'
              : '<rect x="' + wx + '" y="' + wy + '" width="1" height="1" fill="var(--win)"/>';
          }
        }
      }
      x += w + (r() > .6 ? 1 : 0);
    }
    svg.innerHTML = h;
  }

  return { toast: toast, copy: copy, skyline: skyline };
})();
