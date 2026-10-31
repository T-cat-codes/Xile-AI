# Closes Xile AI if it's open and starts it again (used after changing main.js).
$app = Split-Path $PSScriptRoot
Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$app*" } | Stop-Process -Force
Start-Sleep 1
Start-Process (Join-Path $app 'node_modules\electron\dist\electron.exe') -ArgumentList ('"' + $app + '"')
