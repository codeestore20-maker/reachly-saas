@echo off
git add .
git commit -m "Fix: Return followers array directly for frontend compatibility"
git push origin main
echo.
echo ✅ Response format fixed!
pause
