@echo off
git add .
git commit -m "Fix: Prevent infinite polling loops in campaign pages"
git push origin main
echo.
echo ✅ Polling fixed!
echo ✅ No more excessive GET requests!
pause
