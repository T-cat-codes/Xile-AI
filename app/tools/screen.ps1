# Screen control for Xile AI: screenshot, click, type, keys, scroll on the main monitor.
# Positions are 0-1000 across and down the screen. Text to type comes in the XILE_TEXT variable.
param(
  [string]$Action,
  [double]$X = 500,
  [double]$Y = 500,
  [string]$Button = 'left',
  [int]$Clicks = 1,
  [string]$Keys = '',
  [string]$Direction = 'down',
  [int]$Amount = 5,
  [string]$Out = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class XileInput {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, int data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
}
"@
[XileInput]::SetProcessDPIAware() | Out-Null
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

function Move-To([double]$nx, [double]$ny) {
  $px = [int]($screen.X + [Math]::Min([Math]::Max($nx, 0), 1000) / 1000 * ($screen.Width - 1))
  $py = [int]($screen.Y + [Math]::Min([Math]::Max($ny, 0), 1000) / 1000 * ($screen.Height - 1))
  [XileInput]::SetCursorPos($px, $py) | Out-Null
  Start-Sleep -Milliseconds 60
}

$vk = @{
  ctrl = 0x11; control = 0x11; shift = 0x10; alt = 0x12; win = 0x5B; windows = 0x5B
  enter = 0x0D; return = 0x0D; esc = 0x1B; escape = 0x1B; tab = 0x09; backspace = 0x08
  delete = 0x2E; del = 0x2E; space = 0x20; up = 0x26; down = 0x28; left = 0x25; right = 0x27
  home = 0x24; end = 0x23; pageup = 0x21; pagedown = 0x22; insert = 0x2D; printscreen = 0x2C
}
function Get-Vk([string]$name) {
  $n = $name.Trim().ToLower()
  if ($vk.ContainsKey($n)) { return [byte]$vk[$n] }
  if ($n -match '^f([1-9]|1[0-2])$') { return [byte](0x6F + [int]$Matches[1]) }
  if ($n.Length -eq 1 -and $n -match '[a-z0-9]') { return [byte][char]$n.ToUpper() }
  throw "Unknown key: $name"
}

switch ($Action) {
  'screenshot' {
    $full = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
    $g = [System.Drawing.Graphics]::FromImage($full)
    $g.CopyFromScreen($screen.X, $screen.Y, 0, 0, $full.Size)
    # Draw the mouse pointer so the AI can see where it is.
    $c = [System.Windows.Forms.Cursor]::Position
    $g.FillEllipse([System.Drawing.Brushes]::Red, $c.X - $screen.X - 5, $c.Y - $screen.Y - 5, 10, 10)
    $w = [Math]::Min(1280, $screen.Width)
    $h = [int]($screen.Height * $w / $screen.Width)
    $small = New-Object System.Drawing.Bitmap $w, $h
    $g2 = [System.Drawing.Graphics]::FromImage($small)
    $g2.InterpolationMode = 'HighQualityBicubic'
    $g2.DrawImage($full, 0, 0, $w, $h)
    $small.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
    '{"screenW":' + $screen.Width + ',"screenH":' + $screen.Height + ',"width":' + $w + ',"height":' + $h + '}'
  }
  'click' {
    Move-To $X $Y
    $flags = @{ left = @(0x02, 0x04); right = @(0x08, 0x10); middle = @(0x20, 0x40) }[$Button.ToLower()]
    if (-not $flags) { $flags = @(0x02, 0x04) }
    for ($i = 0; $i -lt $Clicks; $i++) {
      [XileInput]::mouse_event($flags[0], 0, 0, 0, [UIntPtr]::Zero)
      [XileInput]::mouse_event($flags[1], 0, 0, 0, [UIntPtr]::Zero)
      Start-Sleep -Milliseconds 80
    }
    'ok'
  }
  'scroll' {
    Move-To $X $Y
    $delta = if ($Direction -eq 'up') { 120 } else { -120 }
    for ($i = 0; $i -lt $Amount; $i++) { [XileInput]::mouse_event(0x0800, 0, 0, $delta, [UIntPtr]::Zero); Start-Sleep -Milliseconds 30 }
    'ok'
  }
  'type' {
    # SendKeys treats + ^ % ~ ( ) { } [ ] as commands, so wrap them in braces.
    $text = $env:XILE_TEXT -replace "`r", ''
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $text.ToCharArray()) {
      if ('+^%~(){}[]'.Contains([string]$ch)) { [void]$sb.Append('{' + $ch + '}') }
      elseif ($ch -eq "`n") { [void]$sb.Append('{ENTER}') }
      else { [void]$sb.Append($ch) }
    }
    [System.Windows.Forms.SendKeys]::SendWait($sb.ToString())
    'ok'
  }
  'keys' {
    $codes = @($Keys -split '\+' | Where-Object { $_.Trim() } | ForEach-Object { Get-Vk $_ })
    foreach ($k in $codes) { [XileInput]::keybd_event($k, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 30 }
    [array]::Reverse($codes)
    foreach ($k in $codes) { [XileInput]::keybd_event($k, 0, 2, [UIntPtr]::Zero); Start-Sleep -Milliseconds 30 }
    'ok'
  }
  default { throw "Unknown action: $Action" }
}
