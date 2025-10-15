@echo off
git add .
git commit -m "Fix: Completely disable Redis when not configured properly"
git push origin main
echo.
echo ✅ Redis completely disabled now!
pause
