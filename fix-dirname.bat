@echo off
git add .
git commit -m "Fix: Add __dirname for ES modules"
git push origin main
echo.
echo ✅ Fix pushed!
pause
