@echo off
git add .
git commit -m "Fix: Make Redis optional - app works without it"
git push origin main
echo.
echo ✅ Redis is now optional!
pause
