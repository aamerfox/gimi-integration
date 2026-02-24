@echo off
title Updating DigitalOcean Server...
echo ========================================================
echo Updating Nginx Configuration on DigitalOcean: 68.183.73.150
echo ========================================================
echo.
echo Step 1: Uploading the configuration script to your server...
echo [Prompting for server password - your characters won't show]
scp "update-server.js" root@68.183.73.150:/root/update-server.js
echo.
echo Step 2: Executing script and restarting Nginx...
echo [Prompting for server password again]
ssh root@68.183.73.150 "node /root/update-server.js && nginx -t && systemctl reload nginx"
echo.
echo ========================================================
echo ALL DONE! 
echo The API proxy has been applied to the live server.
echo Both your Mobile App and Web App can now connect to http://68.183.73.150/token
echo ========================================================
pause
