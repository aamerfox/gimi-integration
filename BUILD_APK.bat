@echo off
echo ==========================================
echo Building TracePlus Gimi Mobile APK...
echo ==========================================

cd /d "%~dp0\gimi-mobile"

echo.
echo [1/3] Cleaning up dirty Ninja build cache...
if exist "node_modules\react-native-screens\android\.cxx" (
    rmdir /s /q "node_modules\react-native-screens\android\.cxx"
)
if exist "node_modules\expo-modules-core\android\.cxx" (
    rmdir /s /q "node_modules\expo-modules-core\android\.cxx"
)

cd android

echo.
echo [2/3] Cleaning Gradle project...
call gradlew clean

echo.
echo [3/3] Compiling Release APK...
call gradlew assembleRelease

echo.
echo ==========================================
if exist "app\build\outputs\apk\release\app-release.apk" (
    echo Build Successful! Copying APK...
    copy /Y "app\build\outputs\apk\release\app-release.apk" "..\app-release-latest.apk"
    echo.
    echo Your new APK is ready at:
    echo gimi-mobile\app-release-latest.apk
) else (
    echo Build Failed! Please check the terminal for errors.
)
echo ==========================================
pause
