@echo off
cd /d "%~dp0"
echo 🚀 Starting Go server...
go run main.go
if errorlevel 1 (
    echo.
    echo [!] Server exited with an error.
    pause
)
