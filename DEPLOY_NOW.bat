@echo off
echo ==========================================
echo Deploying Gimi to Live Server...
echo ==========================================

cd /d "%~dp0"
node scratch/deploy_to_live.mjs

echo.
echo ==========================================
echo Deployment completed!
pause
