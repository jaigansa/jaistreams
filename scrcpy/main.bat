@echo off
setlocal enabledelayedexpansion

:: Default TCPIP port
set PHONE_PORT=5555
set TEMP_IP_FILE=%TEMP%\last_phone_ip.txt

:: 1. Detect all devices
echo [*] Detecting devices...
set DEVICE_COUNT=0
for /f "tokens=1,2" %%A in ('adb devices') do (
    if "%%B"=="device" (
        set /a DEVICE_COUNT+=1
        set "DEVICE_!DEVICE_COUNT!=%%A"
    )
)

set SELECTED_DEVICE=

if !DEVICE_COUNT! equ 0 (
    :: No active devices, try to fall back to cached IP
    if exist "%TEMP_IP_FILE%" (
        set /p PHONE_IP=<"%TEMP_IP_FILE%"
        echo [!] No active devices found. Attempting to connect to last saved IP: !PHONE_IP!
        set "SELECTED_DEVICE=!PHONE_IP!:!PHONE_PORT!"
        adb connect !SELECTED_DEVICE!
        timeout /t 2 >nul
    ) else (
        echo [-] No devices detected and no saved IP found.
        exit /b 1
    )
) else if !DEVICE_COUNT! equ 1 (
    set "SELECTED_DEVICE=!DEVICE_1!"
    echo [+] Device auto-selected: !SELECTED_DEVICE!
) else (
    echo [*] Multiple devices detected:
    for /l %%i in (1, 1, !DEVICE_COUNT!) do (
        echo   [%%i] !DEVICE_%%i!
    )
    
    :CHOOSE_DEVICE
    set /p "CHOICE=Select a device by entering its number (1-!DEVICE_COUNT!): "
    
    :: Validate input is a number and within range
    set "VALID="
    for /l %%i in (1, 1, !DEVICE_COUNT!) do (
        if "!CHOICE!"=="%%i" set "VALID=1"
    )
    
    if not "!VALID!"=="1" (
        echo [-] Invalid selection. Please try again.
        goto CHOOSE_DEVICE
    )
    
    :: Set chosen device
    for /l %%i in (1, 1, !DEVICE_COUNT!) do (
        if "!CHOICE!"=="%%i" set "SELECTED_DEVICE=!DEVICE_%%i!"
    )
)

:: 2. Select performance settings
echo.
echo [*] Select Performance Profile:
echo   [1] High Quality (1080p, 60fps, 16M bitrate)
echo   [2] Standard (1080p, 30fps, 12M bitrate - Original)
echo   [3] Low Latency / Wi-Fi (720p, 30fps, 4M bitrate)

:CHOOSE_PROFILE
set "PROFILE_CHOICE=2"
set /p "PROFILE_CHOICE=Select profile [1-3] (Default is 2): "

set "VALID_PROFILE="
if "!PROFILE_CHOICE!"=="1" set "VALID_PROFILE=1"
if "!PROFILE_CHOICE!"=="2" set "VALID_PROFILE=1"
if "!PROFILE_CHOICE!"=="3" set "VALID_PROFILE=1"

if not "!VALID_PROFILE!"=="1" (
    echo [-] Invalid selection. Please try again.
    goto CHOOSE_PROFILE
)

set "MAX_SIZE=1920"
set "MAX_FPS=30"
set "BITRATE=12M"

if "!PROFILE_CHOICE!"=="1" (
    set "MAX_SIZE=1920"
    set "MAX_FPS=60"
    set "BITRATE=16M"
)
if "!PROFILE_CHOICE!"=="3" (
    set "MAX_SIZE=1280"
    set "MAX_FPS=30"
    set "BITRATE=4M"
)

:: 3. Check if selected device is USB or Wi-Fi (Wi-Fi devices contain a colon ":")
echo !SELECTED_DEVICE! | findstr /C:":" >nul
if errorlevel 1 (
    :: It is a USB device
    echo [+] USB device selected: !SELECTED_DEVICE!
    echo [*] Enabling TCPIP mode on port %PHONE_PORT%...
    adb -s !SELECTED_DEVICE! tcpip %PHONE_PORT%
    timeout /t 2 >nul

    :: Get phone Wi-Fi IP automatically
    echo [*] Fetching IP address from device...
    set PHONE_IP=
    for /f "tokens=2" %%i in ('adb -s !SELECTED_DEVICE! shell ip addr show wlan0 ^| findstr /C:"inet "') do (
        for /f "tokens=1 delims=/" %%j in ("%%i") do (
            set PHONE_IP=%%j
        )
    )

    if "!PHONE_IP!"=="" (
        echo [-] Could not detect Wi-Fi IP. Make sure phone is connected to Wi-Fi.
        exit /b 1
    )

    echo [+] Phone Wi-Fi IP detected: !PHONE_IP!

    :: Save IP for later runs without USB (prefix redirection to avoid digit trailing parser bug)
    > "%TEMP_IP_FILE%" echo !PHONE_IP!

    :: Connect over Wi-Fi
    set "SELECTED_DEVICE=!PHONE_IP!:!PHONE_PORT!"
    echo [*] Connecting to !SELECTED_DEVICE!...
    adb connect !SELECTED_DEVICE!
    timeout /t 2 >nul
)

:: 4. Verify connection and start scrcpy
set VERIFIED_DEVICE=
for /f "tokens=1,2" %%A in ('adb devices') do (
    if "%%B"=="device" (
        echo %%A | findstr /C:"!SELECTED_DEVICE!" >nul
        if not errorlevel 1 (
            set "VERIFIED_DEVICE=%%A"
        )
    )
)

if not "!VERIFIED_DEVICE!"=="" (
    echo [+] Launching scrcpy on !VERIFIED_DEVICE!...
    scrcpy --serial "!VERIFIED_DEVICE!" ^
           --no-control ^
           --max-size=!MAX_SIZE! ^
           --max-fps=!MAX_FPS! ^
           --no-mipmaps ^
           --video-bit-rate=!BITRATE! ^
           --audio-dup
) else (
    echo [-] Could not verify connection to !SELECTED_DEVICE!
)
