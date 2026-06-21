# Create certs directory if not exists
$certsDir = Join-Path $PSScriptRoot "certs"
if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
    Write-Host "Created $certsDir directory." -ForegroundColor Green
}

# Check if openssl is available
if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    Write-Host "Warning: OpenSSL command was not found directly in PowerShell PATH." -ForegroundColor Yellow
    Write-Host "Attempting to search in common Git installation paths..." -ForegroundColor Yellow
    
    $gitOpenSsl = "C:\Program Files\Git\usr\bin\openssl.exe"
    if (Test-Path $gitOpenSsl) {
        Set-Alias -Name openssl -Value $gitOpenSsl
        Write-Host "Found OpenSSL in Git path: $gitOpenSsl" -ForegroundColor Green
    } else {
        Write-Error "OpenSSL is not installed or not in your PATH. Please install OpenSSL or run this script from a Git Bash terminal."
        Exit 1
    }
}

# Generate self-signed certificate
$keyPath = Join-Path $certsDir "server.key"
$certPath = Join-Path $certsDir "server.crt"

Write-Host "Generating self-signed SSL certificate..." -ForegroundColor Cyan
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout $keyPath `
  -out $certPath `
  -subj "/C=US/ST=State/L=City/O=TracePlus/OU=Development/CN=tag.traceplus.co"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully generated certificate and key in $certsDir!" -ForegroundColor Green
    Write-Host "Key: $keyPath" -ForegroundColor Gray
    Write-Host "Cert: $certPath" -ForegroundColor Gray
} else {
    Write-Error "Failed to generate certificates using OpenSSL."
}
