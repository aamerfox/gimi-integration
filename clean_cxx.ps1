$ErrorActionPreference = "SilentlyContinue"
Write-Host "Finding .cxx directories..."
$dirs = Get-ChildItem -Path "c:\Users\aamer\Desktop\SaudiEx project agents\gimi integrartion\gimi-mobile" -Filter ".cxx" -Recurse -Directory
foreach ($dir in $dirs) {
    $path = $dir.FullName
    Write-Host "Deleting: $path"
    # Try deleting with \\?\ prefix
    Remove-Item -LiteralPath "\\?\$path" -Force -Recurse
}
Write-Host "Done."
