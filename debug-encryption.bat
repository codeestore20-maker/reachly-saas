@echo off
git add .
git commit -m "Debug: Add encryption key validation and logging"
git push origin main
echo.
echo ✅ Debug version pushed!
echo Check Railway logs for encryption key info
pause
