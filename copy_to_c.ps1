$ErrorActionPreference = "SilentlyContinue"
$src = "c:\Users\aamer\Desktop\SaudiEx project agents\traceplus oci\gimi-mobile"
$dst = "C:\gimi-mobile"

Write-Host "Creating target directory $dst..."
New-Item -ItemType Directory -Force -Path $dst | Out-Null

Write-Host "Copying gimi-mobile source and config files..."
robocopy $src $dst package.json package-lock.json tsconfig.json app.json app.config.js metro.config.js .env eas.json expo-env.d.ts /ndl /nfl /njh /njs

$dirsToCopy = @("app", "assets", "components", "constants", "hooks", "utils", "store", "services", "localization", "config", "patch")
foreach ($dir in $dirsToCopy) {
    Write-Host "Copying $dir..."
    robocopy "$src\$dir" "$dst\$dir" /e /ndl /nfl /njh /njs
}

Write-Host "Copying android source code (excluding build folders)..."
robocopy "$src\android" "$dst\android" /e /xd .gradle build app\build .cxx /ndl /nfl /njh /njs

Write-Host "Copying node_modules..."
robocopy "$src\node_modules" "$dst\node_modules" /e /xd .cache /ndl /nfl /njh /njs

Write-Host "Writing local.properties for C:\gimi-mobile path..."
Set-Content -Path "$dst\android\local.properties" -Value "sdk.dir=C\:\\Users\\aamer\\AppData\\Local\\Android\\Sdk"

Write-Host "Copy completed. Project ready at $dst"
