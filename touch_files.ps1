$now = Get-Date
$targets = @(
    "c:\Users\aamer\Desktop\SaudiEx project agents\gimi integrartion\gimi-mobile\android",
    "c:\Users\aamer\Desktop\SaudiEx project agents\gimi integrartion\gimi-mobile\node_modules\react-native-screens",
    "c:\Users\aamer\Desktop\SaudiEx project agents\gimi integrartion\gimi-mobile\node_modules\expo-modules-core"
)
foreach ($target in $targets) {
    if (Test-Path $target) {
        Write-Host "Touching files in $target"
        Get-ChildItem -Path $target -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $_.LastWriteTime = $now
            } catch {}
        }
    }
}
Write-Host "Done."
