/* =====================================================================
   ChaaTown - config.js
   Data penting yang dipakai JavaScript (form pembelian Top Up).
   DIKUNCI: jangan ubah nama, harga, atau jumlah koin tanpa keputusan resmi.
   Setelah mengubah apa pun, jalankan:  _tools\cek-aset.ps1

   Catatan: IP server, port Bedrock, link Discord/Saweria, dan sosial media
   ditulis langsung di HTML (supaya tetap tampil walau JavaScript mati).
   Semuanya juga diperiksa oleh _tools\cek-aset.ps1.
   ===================================================================== */
window.CHAATOWN = {
  // Rank VIP: nama dan harga (Rupiah)
  RANKS: [{name:'Adventurer',price:15000},{name:'Knight',price:30000},{name:'Noble',price:60000},{name:'Archmage',price:90000},{name:'Legend',price:120000}],

  // Paket Paw Coin: nama, jumlah koin (teks), dan harga (Rupiah)
  PACKS: [{name:'Pouch of Coins',amt:'7.500',price:5000},{name:'Bag of Coins',amt:'25.000',price:15000},{name:'Chest of Coins',amt:'60.000',price:30000},{name:'Vault of Coins',amt:'125.000',price:50000}]
};
