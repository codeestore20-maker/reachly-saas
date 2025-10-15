@echo off
git add .
git commit -m "Debug: Add detailed console logging for encryption key"
git push origin main
echo.
echo ✅ Debug v2 pushed!
echo Check Railway Deploy Logs (not just app logs)
pause
