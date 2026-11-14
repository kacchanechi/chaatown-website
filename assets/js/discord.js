/* =====================================================================
   ChaaTown - discord.js (khusus discord/index.html)
   ===================================================================== */
(function () {
  // Deretan gelas pixel di atas meja bar: grid 64x8
  var svg = document.getElementById('bar'), h = '', cols = ['#aac1e9', '#f9c8d5', '#d4c8f3', '#b8e2d4'];
  for (var x = 2, i = 0; x < 60; x += 9, i++) {
    var c = cols[i % 4];
    h += '<rect x="' + x + '" y="2" width="4" height="5" fill="' + c + '"/>' +
         '<rect x="' + (x + 4) + '" y="3" width="1" height="3" fill="' + c + '"/>' +
         '<rect x="' + x + '" y="1" width="4" height="1" fill="#fff"/>';
  }
  svg.innerHTML = h;
})();
