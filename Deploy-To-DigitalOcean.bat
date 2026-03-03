@echo off
title Deploying Gimi Tracking App...
echo ========================================================
echo Deploying React Application to DigitalOcean: 68.183.73.150
echo ========================================================
echo.
echo Step 1: Connecting to the server and deploying...
echo [Prompting for server password - your characters won't show]
ssh root@68.183.73.150 "cd /var/www && rm -rf gimi-integration && git clone https://github.com/aamerfox/gimi-integration.git && cd gimi-integration/gimi-tracking-app && npm install && npm run build && rm -rf /var/www/html/* && cp -r dist/* /var/www/html/ && echo 'Deployment Complete!'"
echo.
echo ========================================================
echo ALL DONE! 
echo The tracking app has been built and deployed to the live server.
echo You can view it at: http://68.183.73.150
echo ========================================================
pause
