$now = Get-Date
Write-Host "Current system time: $now"
Write-Host "Searching for files with timestamps in the future in SDK..."
$futureFiles = Get-ChildItem -Path "C:\Users\aamer\AppData\Local\Android\Sdk" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt $now }
if ($futureFiles) {
    Write-Host "Found $($futureFiles.Count) files in the future:"
    foreach ($file in $futureFiles | Select-Object -First 30) {
        Write-Host "$($file.LastWriteTime) - $($file.FullName)"
    }
} else {
    Write-Host "No files found in the future in SDK."
}
