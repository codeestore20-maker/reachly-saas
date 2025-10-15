@echo off
git add .
git commit -m "Fix: Add Railway URL to CORS allowed origins"
git push origin main
echo.
echo ✅ CORS completely fixed now!
pause
