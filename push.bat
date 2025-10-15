@echo off
echo 🔄 Adding remote repository...
git remote add origin https://github.com/Balawi993/reachly-saas.git

echo.
echo 🔄 Setting branch to main...
git branch -M main

echo.
echo 🚀 Pushing to GitHub...
git push -u origin main

echo.
echo ✅ Push completed!
echo.
pause
