$ErrorActionPreference = "SilentlyContinue"
Write-Host "Cleaning C:\gimi-mobile build files..."
$dirs = Get-ChildItem -Path "C:\gimi-mobile" -Filter ".cxx" -Recurse -Directory
foreach ($dir in $dirs) {
    $path = $dir.FullName
    Write-Host "Deleting CXX: $path"
    Remove-Item -LiteralPath "\\?\$path" -Force -Recurse
}
$targets = @(
    "C:\gimi-mobile\android\app\build",
    "C:\gimi-mobile\android\build",
    "C:\gimi-mobile\android\.gradle"
)
foreach ($target in $targets) {
    if (Test-Path $target) {
        Write-Host "Deleting Target: $target"
        Remove-Item -LiteralPath "\\?\$target" -Force -Recurse
    }
}
Write-Host "Done."
