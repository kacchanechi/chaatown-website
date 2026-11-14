/* =====================================================================
   ChaaTown - galeri.js (khusus galeri/index.html)
   Daftar foto ada di bagian "TAMBAH FOTO DI SINI" di bawah.
   ===================================================================== */
(function(){
  // ====== TAMBAH FOTO DI SINI ======
  // Satu baris per foto. Taruh file fotonya di folder "galeri/" proyek ini,
  // lalu tulis path-nya dari akar situs (diawali galeri/), seperti contoh di bawah.
  // Contoh (hapus tanda // di depannya untuk memakainya):
  // {file:'galeri/foto-1.webp', player:'NickPemain', caption:'Keterangan singkat'},
  var PHOTOS=[
    {file:'galeri/senja-bangunan-jepang.webp', player:'AyamKekar', caption:'sepertinya saya sudah muak dengan perkulian ini..'},
    {file:'galeri/lodge-salju.webp', player:'Gikx', caption:'New Empire'},
    {file:'galeri/foto-bareng-malam.webp', player:'AyamKekar', caption:'fotbar atmin dan anyak anyak'},
    {file:'galeri/balkon-bareng.webp', player:'Foksunee', caption:'p'},
    {file:'galeri/kumpul-salju.webp', player:'BlaZeSZ', caption:'saksi tragedi 17 september'},
    {file:'galeri/singgasana.webp', player:'Veneznia', caption:'Singgasana Veneznia'},
    {file:'galeri/santai-teras.webp', player: 'BlaZeSZ', caption:'ilham ilmu hytam'},
    {file:'galeri/tavern-malam.webp', player:'BlaZeSZ', caption:'Onsen'},
    {file:'galeri/senjata-merah.webp', player:'Gikx', caption:'gede juga kapak gwehh'},
    {file:'galeri/pertarungan-gua.webp', player:'BlaZeSZ & Foksunee', caption:'blublub.. blubublubub!'},
    {file:'galeri/malam-hujan-portal.webp', player:'Gikx', caption:'3 portal di pulau Kepunyaan'},
    {file:'galeri/patung-batu.webp', player:'Veneznia', caption:'Urraa!'},
  ];
  var DEMO=false;
  var ROOT='../'; // halaman ini ada di /galeri/, jadi path foto dihitung dari satu folder di atasnya
  // =================================
  if(DEMO){PHOTOS=[
    {emoji:'\ud83c\udff0',player:'NickPemain1',caption:'Kastil di tepi danau'},
    {emoji:'\ud83c\udf38',player:'NickPemain2',caption:'Kebun di musim semi'},
    {emoji:'\u2694\ufe0f',player:'NickPemain3',caption:'Selesai menaklukkan dungeon'},
    {emoji:'\ud83c\udf42',player:'NickPemain4',caption:'Desa di musim gugur'},
    {emoji:'\u2744\ufe0f',player:'NickPemain5',caption:'Petualangan di Frostbound'},
    {emoji:'\ud83c\udf7b',player:'NickPemain6',caption:'Ngumpul di tavern'}
  ]}
  var TONES=['#b9cdf0','#f9c8d5','#d4c8f3','#fbe3a0'];
  var grid=document.getElementById('grid'),empty=document.getElementById('empty');
  var lb=document.getElementById('lb'),lbm=document.getElementById('lbm'),lbc=document.getElementById('lbc');
  var cur=0,last=null,page=document.querySelector('.page');
  if(!PHOTOS.length)empty.hidden=false;
  function label(p){return (p.caption||'Foto pemain')+(p.player?' - oleh '+p.player:'')}
  function media(p,i,big){
    var m=document.createElement('div');
    if(p.file){
      var im=new Image();im.alt=label(p);if(!big)im.loading='lazy';im.src=ROOT+p.file;
      im.onerror=function(){m.className='ph';m.style.background=TONES[i%4];m.style.fontSize='15px';m.textContent='Foto belum ditemukan';im.remove()};
      m.appendChild(im);
    }else{m.className='ph';m.style.background=TONES[i%4];m.textContent=p.emoji||'\ud83d\uddbc\ufe0f'}
    return m;
  }
  PHOTOS.forEach(function(p,i){
    var b=document.createElement('button');b.type='button';b.className='gc';
    b.setAttribute('aria-label','Perbesar foto: '+label(p));
    var gm=media(p,i,false);gm.classList.add('gm');
    var t=document.createElement('div');t.className='gt';
    var c=document.createElement('b');c.textContent=p.caption||'Foto pemain';t.appendChild(c);
    if(p.player){var s=document.createElement('span');s.textContent='oleh '+p.player;t.appendChild(s)}
    b.appendChild(gm);b.appendChild(t);
    b.addEventListener('click',function(){openLb(i)});
    grid.appendChild(b);
  });
  function show(i){
    cur=(i+PHOTOS.length)%PHOTOS.length;var p=PHOTOS[cur];
    lbm.innerHTML='';lbm.appendChild(media(p,cur,true));lbc.textContent=label(p);
  }
  function openLb(i){last=document.activeElement;show(i);lb.hidden=false;if(page)page.inert=true;document.body.style.overflow='hidden';document.getElementById('lbx').focus()}
  function closeLb(){lb.hidden=true;if(page)page.inert=false;document.body.style.overflow='';if(last)last.focus()}
  document.getElementById('lbx').addEventListener('click',closeLb);
  document.getElementById('lbp').addEventListener('click',function(){show(cur-1)});
  document.getElementById('lbnx').addEventListener('click',function(){show(cur+1)});
  lb.addEventListener('click',function(e){if(e.target===lb)closeLb()});
  document.addEventListener('keydown',function(e){
    if(lb.hidden)return;
    if(e.key==='Escape')closeLb();
    else if(e.key==='ArrowLeft')show(cur-1);
    else if(e.key==='ArrowRight')show(cur+1);
    else if(e.key==='Tab'){ // kunci fokus di dalam lightbox
      var f=[document.getElementById('lbx'),document.getElementById('lbp'),document.getElementById('lbnx')],k=f.indexOf(document.activeElement);
      e.preventDefault();f[(k+(e.shiftKey?-1:1)+f.length)%f.length].focus();
    }
  });
})();
