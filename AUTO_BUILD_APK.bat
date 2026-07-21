@echo off
echo ==========================================================
echo Starting TracePlus Gimi Mobile APK Automatic Build...
echo ==========================================================
echo.
echo [1/4] Bypassing Windows limitations... 
echo Copying your project to a temporary short path (%TEMP%\gimi_build).
echo This may take a minute or two because of node_modules, please wait...

:: Delete temp folder if it already exists from a failed run
if exist "%TEMP%\gimi_build" rmdir /S /Q "%TEMP%\gimi_build"

:: Use robocopy to mirror the gimi-mobile folder quickly and silently
robocopy "%~dp0gimi-mobile" "%TEMP%\gimi_build" /MIR /MT:16 /NFL /NDL /NJH /NJS /nc /ns /np

echo.
echo [2/4] Cleaning old cache files...
cd /d "%TEMP%\gimi_build\android"
if exist "..\node_modules\react-native-screens\android\.cxx" rmdir /s /q "..\node_modules\react-native-screens\android\.cxx"
if exist "..\node_modules\expo-modules-core\android\.cxx" rmdir /s /q "..\node_modules\expo-modules-core\android\.cxx"
call gradlew clean

echo.
echo [3/4] Compiling your new Release APK...
call gradlew assembleRelease

echo.
echo [4/4] Finalizing...
echo ==========================================================
if exist "%TEMP%\gimi_build\android\app\build\outputs\apk\release\app-release.apk" (
    echo Build Successful! Copying APK back to your Desktop...
    copy /Y "%TEMP%\gimi_build\android\app\build\outputs\apk\release\app-release.apk" "%~dp0gimi-mobile\app-release-latest.apk"
    echo.
    echo Your new APK is ready at:
    echo gimi-mobile\app-release-latest.apk
) else (
    echo Build Failed! Please check the terminal for errors.
)
echo ==========================================================

echo Please DO NOT close this window yet! Take a screenshot of any RED errors above.
echo.
pause
