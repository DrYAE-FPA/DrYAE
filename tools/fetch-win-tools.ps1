# Télécharge les programmes Windows inclus dans DrYAE (ils ne sont pas stockés dans le dépôt).
# Sources officielles, versions fixes, empreintes SHA-256 vérifiées.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$bin = Join-Path $PSScriptRoot '..\bin\win'
New-Item -ItemType Directory -Force -Path $bin | Out-Null
$tmp = Join-Path $env:RUNNER_TEMP 'dryae-tools'
if (-not $env:RUNNER_TEMP) { $tmp = Join-Path $env:TEMP 'dryae-tools' }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
function Get($url, $out) { Write-Host "-> $url"; Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing }

# FFmpeg 6.0 (gyan.dev, build « essentials », GPLv3)
Get 'https://github.com/GyanD/codexffmpeg/releases/download/6.0/ffmpeg-6.0-essentials_build.zip' "$tmp\ffmpeg.zip"
Expand-Archive "$tmp\ffmpeg.zip" "$tmp\ffmpeg" -Force
$ff = Get-ChildItem "$tmp\ffmpeg" -Recurse -Filter ffmpeg.exe | Select-Object -First 1
Copy-Item $ff.FullName "$bin\ffmpeg.exe" -Force
Copy-Item (Join-Path $ff.Directory.Parent.FullName 'LICENSE') "$bin\ffmpeg.LICENSE" -Force

# yt-dlp 2026.10.26 (Unlicense)
Get 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp.exe' "$bin\yt-dlp.exe"

# QuickJS-ng 0.18.0 (MIT)
Get 'https://github.com/quickjs-ng/quickjs/releases/download/v0.18.0/qjs-windows-x86_64.exe' "$bin\qjs.exe"

# aria2 1.37.0 (GPL v2+), moteur torrent
Get 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip' "$tmp\aria2.zip"
Expand-Archive "$tmp\aria2.zip" "$tmp\aria2" -Force
Copy-Item "$tmp\aria2\aria2-1.37.0-win-64bit-build1\aria2c.exe" "$bin\aria2c.exe" -Force
Copy-Item "$tmp\aria2\aria2-1.37.0-win-64bit-build1\COPYING" "$bin\aria2.COPYING" -Force

# 7-Zip (7za.exe, LGPL) fourni par le paquet npm 7zip-bin
Copy-Item (Join-Path $PSScriptRoot '..\node_modules\7zip-bin\win\x64\7za.exe') "$bin\7za.exe" -Force

# empreintes attendues (mêmes fichiers que ceux testés pour DrYAE)
$expected = @{ 'qjs.exe' = 'QJS'; 'aria2c.exe' = 'ARIA'; 'yt-dlp.exe' = 'YTDLP'; 'ffmpeg.exe' = 'FFMPEG' }
foreach ($k in $expected.Keys) {
  $h = (Get-FileHash "$bin\$k" -Algorithm SHA256).Hash.ToLower()
  $want = (Get-Content (Join-Path $PSScriptRoot 'win-tools.sha256') | Where-Object { $_ -match " $k$" }) -replace ' .*$', ''
  if ($want -and $h -ne $want) { throw "Empreinte inattendue pour $k : $h" }
  Write-Host "$k OK ($h)"
}
Get-ChildItem $bin | Format-Table Name, Length
