@echo off
git add .
git commit -m "Trigger rebuild - ensure frontend builds correctly" --allow-empty
git push origin main
echo.
echo ✅ Rebuild triggered!
echo Check Railway Build Logs to see if vite build succeeds
pause
