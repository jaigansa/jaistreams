#!/bin/bash

# Default TCPIP port
PHONE_PORT="5555"

# 1. Detect USB device
USB_DEVICE=$(adb devices | grep -w "device" | grep -v ":" | awk '{print $1}')

if [ -n "$USB_DEVICE" ]; then
    echo "📱 USB device detected: $USB_DEVICE"
    echo "➡️ Enabling TCPIP mode on port $PHONE_PORT..."
    adb -s "$USB_DEVICE" tcpip $PHONE_PORT
    sleep 2

    # 2. Get phone Wi-Fi IP automatically
    PHONE_IP=$(adb -s "$USB_DEVICE" shell ip -f inet addr show wlan0 | grep "inet " | awk '{print $2}' | cut -d/ -f1)

    if [ -z "$PHONE_IP" ]; then
        echo "❌ Could not detect Wi-Fi IP. Make sure phone is connected to Wi-Fi."
        exit 1
    fi

    echo "🌐 Phone Wi-Fi IP detected: $PHONE_IP"

    # Save IP for later runs without USB
    echo "$PHONE_IP" > /tmp/last_phone_ip
else
    # No USB, use last saved IP
    if [ -f /tmp/last_phone_ip ]; then
        PHONE_IP=$(cat /tmp/last_phone_ip)
        echo "⚡ No USB device found. Using saved IP: $PHONE_IP"
    else
        echo "❌ No USB device and no saved IP"
        exit 1
    fi
fi

# 3. Connect over Wi-Fi
echo "🌐 Connecting to ${PHONE_IP}:${PHONE_PORT}..."
adb connect ${PHONE_IP}:${PHONE_PORT}
sleep 2

# 4. Verify connection
DEVICE=$(adb devices | grep "${PHONE_IP}:${PHONE_PORT}" | awk '{print $1}')

if [ -n "$DEVICE" ]; then
    echo "✅ Connected to $DEVICE"
    scrcpy --serial "$DEVICE" \
            --no-control    \
           --max-size=1920 \
           --max-fps=30 \
           --no-mipmaps \
           --video-bit-rate=12M \
           --audio-du
else
    echo "❌ Could not connect to ${PHONE_IP}:${PHONE_PORT}"
fi
