# Default TCPIP port
$PHONE_PORT = "5555"
$TEMP_IP_FILE = Join-Path $env:TEMP "last_phone_ip.txt"

# 1. Get all connected devices
Write-Host "[*] Detecting devices..." -ForegroundColor Cyan
$devicesLines = adb devices
$connectedDevices = $devicesLines | Where-Object { $_ -match '\bdevice\b' } | ForEach-Object {
    ($_ -split '\s+')[0]
}

$selectedDevice = $null

if ($connectedDevices.Count -eq 0) {
    # No active devices, try to fall back to cached IP
    if (Test-Path $TEMP_IP_FILE) {
        $PHONE_IP = Get-Content -Path $TEMP_IP_FILE -Raw
        Write-Host "[!] No active devices found. Attempting to connect to last saved IP: $PHONE_IP" -ForegroundColor Yellow
        $selectedDevice = "${PHONE_IP}:${PHONE_PORT}"
        adb connect $selectedDevice
        Start-Sleep -Seconds 2
    } else {
        Write-Error "[-] No devices detected and no saved IP found."
        exit 1
    }
} elseif ($connectedDevices.Count -eq 1) {
    $selectedDevice = $connectedDevices[0]
    Write-Host "[+] Device auto-selected: $selectedDevice" -ForegroundColor Green
} else {
    Write-Host "[*] Multiple devices detected:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $connectedDevices.Count; $i++) {
        Write-Host "  [$($i + 1)] $($connectedDevices[$i])" -ForegroundColor Cyan
    }
    
    $choice = -1
    while ($choice -lt 1 -or $choice -gt $connectedDevices.Count) {
        $input = Read-Host "Select a device by entering its number (1-$($connectedDevices.Count))"
        if ([int]::TryParse($input, [ref]$choice)) {
            if ($choice -lt 1 -or $choice -gt $connectedDevices.Count) {
                Write-Host "Invalid selection. Please try again." -ForegroundColor Red
            }
        } else {
            Write-Host "Invalid input. Please enter a number." -ForegroundColor Red
        }
    }
    $selectedDevice = $connectedDevices[$choice - 1]
}

# 2. Select performance settings
Write-Host ""
Write-Host "[*] Select Performance Profile:" -ForegroundColor Cyan
Write-Host "  [1] High Quality (1080p, 60fps, 16M bitrate)" -ForegroundColor Cyan
Write-Host "  [2] Standard (1080p, 30fps, 12M bitrate - Original)" -ForegroundColor Cyan
Write-Host "  [3] Low Latency / Wi-Fi (720p, 30fps, 4M bitrate)" -ForegroundColor Cyan

$profileChoice = -1
while ($profileChoice -lt 1 -or $profileChoice -gt 3) {
    $input = Read-Host "Select profile (1-3, Default is 2)"
    if ([string]::IsNullOrWhiteSpace($input)) {
        $profileChoice = 2
    } elseif ([int]::TryParse($input, [ref]$profileChoice)) {
        if ($profileChoice -lt 1 -or $profileChoice -gt 3) {
            Write-Host "Invalid selection. Please try again." -ForegroundColor Red
        }
    } else {
        Write-Host "Invalid input. Please enter a number." -ForegroundColor Red
    }
}

$maxSize = "1920"
$maxFps = "30"
$bitrate = "12M"

if ($profileChoice -eq 1) {
    $maxSize = "1920"
    $maxFps = "60"
    $bitrate = "16M"
} elseif ($profileChoice -eq 3) {
    $maxSize = "1280"
    $maxFps = "30"
    $bitrate = "4M"
}

# 3. Process the selected device
if ($selectedDevice -notmatch ':') {
    # It is a USB device (no colon)
    Write-Host "[+] USB device selected: $selectedDevice" -ForegroundColor Green
    Write-Host "[*] Enabling TCPIP mode on port $PHONE_PORT..." -ForegroundColor Cyan
    adb -s $selectedDevice tcpip $PHONE_PORT
    Start-Sleep -Seconds 2

    # Get phone Wi-Fi IP automatically
    Write-Host "[*] Fetching IP address from device..." -ForegroundColor Cyan
    $ipAddrOutput = (adb -s $selectedDevice shell "ip addr show wlan0") -join "`n"
    if ($ipAddrOutput -match 'inet\s+([0-9\.]+)/') {
        $PHONE_IP = $Matches[1]
    }

    if (-not $PHONE_IP) {
        Write-Error "[-] Could not detect Wi-Fi IP. Make sure phone is connected to Wi-Fi."
        exit 1
    }

    Write-Host "[+] Phone Wi-Fi IP detected: $PHONE_IP" -ForegroundColor Green

    # Save IP for later runs without USB
    $PHONE_IP | Out-File -FilePath $TEMP_IP_FILE -Encoding ascii -NoNewline

    # Connect over Wi-Fi
    $wifiDevice = "${PHONE_IP}:${PHONE_PORT}"
    Write-Host "[*] Connecting to $wifiDevice..." -ForegroundColor Cyan
    adb connect $wifiDevice
    Start-Sleep -Seconds 2
    $selectedDevice = $wifiDevice
}

# 4. Verify connection and start scrcpy
$connectedDeviceCheck = (adb devices) | Where-Object { $_ -match [regex]::Escape($selectedDevice) } | ForEach-Object {
    ($_ -split '\s+')[0]
} | Select-Object -First 1

if ($connectedDeviceCheck) {
    Write-Host "[+] Launching scrcpy on $connectedDeviceCheck..." -ForegroundColor Green
    scrcpy --serial "$connectedDeviceCheck" `
           --no-control `
           --max-size $maxSize `
           --max-fps $maxFps `
           --no-mipmaps `
           --video-bit-rate $bitrate `
           --audio-dup
} else {
    Write-Error "[-] Could not verify connection to $selectedDevice"
}
