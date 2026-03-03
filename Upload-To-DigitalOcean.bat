@echo off
title Uploading Website to DigitalOcean...
echo ========================================================
echo Uploading Built React App to DigitalOcean: 68.183.73.150
echo ========================================================
echo.
echo Your local project has been compiled successfully!
echo Now transferring the 'dist' folder to the server '/var/www/html'...
echo.
echo [Prompting for server password - your characters won't show]
scp -r gimi-tracking-app/dist/* root@68.183.73.150:/var/www/html/
echo.
echo ========================================================
echo ALL DONE! 
echo The tracking app has been deployed to the live server.
echo You can view it at: http://68.183.73.150
echo ========================================================
pause
