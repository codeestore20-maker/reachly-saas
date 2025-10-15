@echo off
git add .
git commit -m "Fix: Use relative API URL in production"
git push origin main
echo.
echo ✅ API URL fixed! Frontend will use /api in production
pause
