/* =====================================================================
   ChaaTown - about.js (khusus about/index.html)
   Butuh: common.js dimuat lebih dulu.
   ===================================================================== */

// Skyline kota di bawah halaman (tanpa jendela berkedip)
ChaaTown.skyline(document.getElementById('sky'), 11, false);

// Bintang berkelip di latar: 78 bintang, posisinya selalu sama (seed tetap)
(function () {
  var box = document.getElementById('stars'), seed = 23;
  function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  var cls = ['', 'b', 'c'];
  for (var i = 0; i < 78; i++) {
    var e = document.createElement('i'), sp = i % 7 === 0, c = cls[Math.floor(r() * 3)];
    e.className = (sp ? 'sp ' : 'd ') + c;
    if (!sp) { var z = 2 + Math.floor(r() * 3); e.style.width = e.style.height = z + 'px'; }
    e.style.left = (r() * 98).toFixed(1) + '%';
    e.style.top = (r() * 78).toFixed(1) + '%';
    e.style.animationDuration = (2 + r() * 3.5).toFixed(1) + 's';
    e.style.animationDelay = '-' + (r() * 5).toFixed(1) + 's';
    box.appendChild(e);
  }
})();
