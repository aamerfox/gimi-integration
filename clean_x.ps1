$ErrorActionPreference = "SilentlyContinue"
Write-Host "Cleaning X:\gimi-mobile build directories..."
$dirs = Get-ChildItem -Path "X:\gimi-mobile" -Filter ".cxx" -Recurse -Directory
foreach ($dir in $dirs) {
    $path = $dir.FullName
    Write-Host "Deleting CXX: $path"
    Remove-Item -LiteralPath "\\?\$path" -Force -Recurse
}
$targets = @(
    "X:\gimi-mobile\android\app\build",
    "X:\gimi-mobile\android\build",
    "X:\gimi-mobile\android\.gradle"
)
foreach ($target in $targets) {
    if (Test-Path $target) {
        Write-Host "Deleting Target: $target"
        Remove-Item -LiteralPath "\\?\$target" -Force -Recurse
    }
}
Write-Host "Done."
