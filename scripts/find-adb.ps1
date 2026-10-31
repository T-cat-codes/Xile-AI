# Debug helper: finds adb.exe, lists connected TVs, and shows whether the TV is awake and what's on screen.
$places = @("$env:LOCALAPPDATA\TVHomeTools\Sdk\platform-tools\adb.exe", "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe", "$env:LOCALAPPDATA\Android\platform-tools\adb.exe")
foreach ($p in $places) { "$p : $(Test-Path $p)" }
$adb = $places | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $adb) { return }
& $adb devices -l
& $adb mdns services
$tv = (& $adb devices | Select-String '^\d+\.\d+\.\d+\.\d+:\d+\s+device' | Select-Object -First 1).ToString().Split()[0]
if ($tv) {
  & $adb -s $tv shell "dumpsys power | grep -E 'mWakefulness=|Display Power'"
  & $adb -s $tv shell "dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' | head -2"
}
