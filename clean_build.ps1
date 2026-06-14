$ErrorActionPreference = "SilentlyContinue"
Write-Host "Cleaning Android build directories..."
$targets = @(
    "c:\Users\aamer\Desktop\SaudiEx project agents\gimi integrartion\gimi-mobile\android\app\build",
    "c:\Users\aamer\Desktop\SaudiEx project agents\gimi integrartion\gimi-mobile\android\build",
    "c:\Users\aamer\Desktop\SaudiEx project agents\gimi integrartion\gimi-mobile\android\.gradle"
)
foreach ($target in $targets) {
    if (Test-Path $target) {
        Write-Host "Deleting $target"
        Remove-Item -LiteralPath "\\?\$target" -Force -Recurse
    }
}
Write-Host "Done."
