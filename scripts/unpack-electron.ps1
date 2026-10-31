# Unpacks Electron from its download cache into node_modules\electron\dist (for when npm's unpack fails).
$ErrorActionPreference = 'Stop'
$app = Split-Path $PSScriptRoot
$zip = Get-ChildItem "$env:LOCALAPPDATA\electron\Cache" -Recurse -Filter 'electron-*win32-x64.zip' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $zip) { throw 'No Electron download found.' }
Write-Host "Unpacking $($zip.Name) ($([math]::Round($zip.Length / 1MB)) MB)..."
$dist = Join-Path $app 'node_modules\electron\dist'
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
Expand-Archive -Path $zip.FullName -DestinationPath $dist -Force
Set-Content -Path (Join-Path $app 'node_modules\electron\path.txt') -Value 'electron.exe' -NoNewline -Encoding ascii
if (Test-Path (Join-Path $dist 'electron.exe')) { Write-Host 'Electron unpacked OK.' } else { throw 'electron.exe still missing.' }
