@echo off
git add .
git commit -m "Fix: Use encrypted_cookies field correctly in extract-followers endpoint"
git push origin main
echo.
echo ✅ Extract followers fixed!
pause
