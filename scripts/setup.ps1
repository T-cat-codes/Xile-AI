# One-time setup for Xile AI: installs its parts (Electron), makes the icon and the desktop shortcut.
# Run again any time; it skips what is already done. Double-click "Setup Xile AI.cmd" to run it.
$ErrorActionPreference = 'Stop'
$app = Split-Path $PSScriptRoot  # the Xile AI folder (this file is in scripts\)
$env:Path = "$env:ProgramFiles\nodejs;$env:Path"
Set-Location $app

if (-not (Test-Path "$env:ProgramFiles\nodejs\node.exe")) {
  Write-Host 'Installing Node.js...'
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
}

$electron = Join-Path $app 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) {
  Write-Host 'Installing Electron (about 110 MB)...'
  & "$env:ProgramFiles\nodejs\npm.cmd" install
  # Newer npm skips install scripts, so run Electron's own download step directly.
  if (-not (Test-Path $electron)) { & "$env:ProgramFiles\nodejs\node.exe" (Join-Path $app 'node_modules\electron\install.js') }
  # Its unpack step can fail silently on Windows; unpack the downloaded zip ourselves.
  if (-not (Test-Path $electron)) { & (Join-Path $app 'scripts\unpack-electron.ps1') }
  if (-not (Test-Path $electron)) { throw 'Electron did not install.' }
}

# The icon: a violet rounded square with a white X. Replace icon.png to use your own.
$png = Join-Path $app 'icon.png'
$ico = Join-Path $app 'icon.ico'
if (-not (Test-Path $png)) {
  Add-Type -AssemblyName System.Drawing
  $bmp = New-Object System.Drawing.Bitmap 256, 256
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $rect = New-Object System.Drawing.Rectangle 8, 8, 240, 240
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 56
  $gp.AddArc($rect.X, $rect.Y, $r, $r, 180, 90); $gp.AddArc($rect.Right - $r, $rect.Y, $r, $r, 270, 90)
  $gp.AddArc($rect.Right - $r, $rect.Bottom - $r, $r, $r, 0, 90); $gp.AddArc($rect.X, $rect.Bottom - $r, $r, $r, 90, 90)
  $gp.CloseFigure()
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(139, 92, 246)), ([System.Drawing.Color]::FromArgb(56, 189, 248)), 45
  $g.FillPath($brush, $gp)
  $font = New-Object System.Drawing.Font 'Segoe UI', 150, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  $g.DrawString('X', $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, 6, 256, 256), $fmt)
  $bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Remove-Item $ico -ErrorAction SilentlyContinue
}
if (-not (Test-Path $ico)) {
  # A .ico file can hold a PNG directly: 6-byte header + 16-byte entry + the PNG.
  $bytes = [IO.File]::ReadAllBytes($png)
  $ms = New-Object IO.MemoryStream
  $w = New-Object IO.BinaryWriter $ms
  $w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]1)
  $w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32); $w.Write([UInt32]$bytes.Length); $w.Write([UInt32]22)
  $w.Write($bytes)
  [IO.File]::WriteAllBytes($ico, $ms.ToArray())
}

# Desktop and Start menu shortcuts start Electron straight on this folder (no black window).
$shell = New-Object -ComObject WScript.Shell
$places = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('Programs')) ''))
foreach ($dir in $places) {
  $lnk = $shell.CreateShortcut((Join-Path $dir 'Xile AI.lnk'))
  $lnk.TargetPath = $electron
  $lnk.Arguments = '"' + $app + '"'
  $lnk.WorkingDirectory = $app
  $lnk.IconLocation = "$ico,0"
  $lnk.Description = 'Xile AI: your offline AI agent'
  $lnk.Save()
}
Write-Host ''
Write-Host 'Xile AI is ready. Double-click "Xile AI" on your desktop.'
