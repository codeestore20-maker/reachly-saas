@echo off
git add .
git commit -m "Fix: Change wildcard route from * to /* for Express compatibility"
git push origin main
echo.
echo ✅ Fix pushed!
pause
