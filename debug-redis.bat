@echo off
git add .
git commit -m "Debug: Add REDIS_URL logging to identify the issue"
git push origin main
echo.
echo ✅ Debug version pushed!
pause
