# =====================================================================
# Cek Aset Terkunci - ChaaTown Website
# ---------------------------------------------------------------------
# Memastikan aset penting (IP, port, link Discord/Saweria, sosial media,
# data rank, Paw Coin, format pesan beli, validasi nickname, galeri, CNAME)
# TIDAK berubah setelah perombakan.
#
# Cara pakai (dari folder proyek):
#   powershell -ExecutionPolicy Bypass -File _tools\cek-aset.ps1
#
# Hasil: setiap baris PASS/FAIL. Exit code 0 = semua aman, 1 = ada yang berubah.
# Folder _tools diawali "_" sehingga tidak ikut dipublikasikan GitHub Pages (Jekyll).
# Baseline: backup v0 (15 November 2026).
# =====================================================================

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# Kumpulkan semua file teks situs (kecuali _tools dan .git)
$files = Get-ChildItem -Path $root -Recurse -File -Include *.html,*.js,*.css,*.xml,*.txt,*.json |
  Where-Object { $_.FullName -notmatch '\\(_tools|\.git)\\' }
$all = ($files | ForEach-Object { Get-Content -Raw -Encoding UTF8 $_.FullName }) -join "`n"

$fail = 0
function Cek([string]$nama, [bool]$ok, [string]$info = '') {
  if ($ok) { Write-Host ("  PASS  " + $nama) -ForegroundColor Green }
  else { Write-Host ("  FAIL  " + $nama + $(if ($info) { "  -> $info" })) -ForegroundColor Red; $script:fail++ }
}
function Ada([string]$teks) { return $all.Contains($teks) }
function Pola([string]$regex) { return [regex]::IsMatch($all, $regex) }

Write-Host "`n== Server & domain"
Cek "IP server play.chaatown.my.id"        (Ada 'play.chaatown.my.id')
Cek "Port Bedrock 5167"                    (Ada '5167')
Cek "Tidak ada port lama 25642"            (-not (Ada '25642'))
$cname = if (Test-Path "$root\CNAME") { (Get-Content -Raw "$root\CNAME").Trim() } else { '' }
Cek "CNAME = chaatown.my.id"               ($cname -eq 'chaatown.my.id') "isi: '$cname'"

Write-Host "`n== Link penting"
Cek "Discord https://discord.gg/txe8h2DSJf" (Ada 'https://discord.gg/txe8h2DSJf')
$dcLain = [regex]::Matches($all, 'discord\.gg/([A-Za-z0-9]+)') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -ne 'txe8h2DSJf' } | Sort-Object -Unique
Cek "Tidak ada link Discord lain"          (-not $dcLain) ($dcLain -join ', ')
Cek "Saweria https://saweria.co/Chreeze"   (Ada 'https://saweria.co/Chreeze')
$swLain = [regex]::Matches($all, 'saweria\.co/([A-Za-z0-9_]+)') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -ne 'Chreeze' } | Sort-Object -Unique
Cek "Tidak ada link Saweria lain"          (-not $swLain) ($swLain -join ', ')
Cek "Instagram its.chreeze_"               (Ada 'https://www.instagram.com/its.chreeze_')
Cek "YouTube @gienchareeze"                (Ada 'https://youtube.com/@gienchareeze')
Cek "WhatsApp Channel"                     (Ada 'https://www.whatsapp.com/channel/0029VbCAGJqLikgE8DZaDS1s')
Cek "TikTok @itschareeze"                  (Ada 'https://www.tiktok.com/@itschareeze')

Write-Host "`n== Data Rank (nama + harga)"
$ranks = @(@('Adventurer',15000), @('Knight',30000), @('Noble',60000), @('Archmage',90000), @('Legend',120000))
foreach ($r in $ranks) {
  Cek ("Rank {0} = Rp {1}" -f $r[0], $r[1]) (Pola ("name\s*:\s*['""]" + [regex]::Escape($r[0]) + "['""]\s*,\s*price\s*:\s*" + $r[1] + "\b"))
}

Write-Host "`n== Data Paw Coin (nama + jumlah + harga)"
$packs = @(@('Pouch of Coins','7.500',5000), @('Bag of Coins','25.000',15000), @('Chest of Coins','60.000',30000), @('Vault of Coins','125.000',50000))
foreach ($p in $packs) {
  Cek ("{0} = {1} koin, Rp {2}" -f $p[0], $p[1], $p[2]) (Pola ("name\s*:\s*['""]" + [regex]::Escape($p[0]) + "['""]\s*,\s*amt\s*:\s*['""]" + [regex]::Escape($p[1]) + "['""]\s*,\s*price\s*:\s*" + $p[2] + "\b"))
}

Write-Host "`n== Format pesan pembelian & validasi"
Cek "Format 'Beli rank <nama> | Nickname: <nick>'" ((Ada "'Beli rank '") -and (Ada "' | Nickname: '"))
Cek "Format 'Beli <paket> (<jml> Paw Coins) | Nickname: <nick>'" (Ada "' Paw Coins) | Nickname: '")
Cek "Validasi nickname 3-24 karakter"      (Pola '\.length\s*<\s*3\s*\|\|\s*\w+\.length\s*>\s*24')
Cek "Pesan error nickname"                 (Ada 'Isi nickname Minecraft-mu (3 sampai 24 karakter).')

Write-Host "`n== Galeri (file + pemilik foto)"
$galeri = @(
  @('senja-bangunan-jepang.webp','AyamKekar'), @('lodge-salju.webp','Gikx'), @('foto-bareng-malam.webp','AyamKekar'),
  @('balkon-bareng.webp','Foksunee'), @('kumpul-salju.webp','BlaZeSZ'), @('singgasana.webp','Veneznia'),
  @('santai-teras.webp','BlaZeSZ'), @('tavern-malam.webp','BlaZeSZ'), @('senjata-merah.webp','Gikx'),
  @('pertarungan-gua.webp','BlaZeSZ & Foksunee'), @('malam-hujan-portal.webp','Gikx'), @('patung-batu.webp','Veneznia')
)
foreach ($g in $galeri) {
  $okFile = Test-Path ("$root\galeri\" + $g[0])
  $okData = Pola ("galeri/" + [regex]::Escape($g[0]) + "['""]\s*,\s*player\s*:\s*['""]" + [regex]::Escape($g[1]) + "['""]")
  Cek ("{0} oleh {1}" -f $g[0], $g[1]) ($okFile -and $okData) $(if (-not $okFile) { 'file foto hilang' } else { 'data di galeri berubah' })
}

Write-Host ""
if ($fail -eq 0) { Write-Host "SEMUA ASET AMAN ($($files.Count) file dicek)." -ForegroundColor Green; exit 0 }
else { Write-Host "$fail CEK GAGAL - ada aset yang berubah!" -ForegroundColor Red; exit 1 }
