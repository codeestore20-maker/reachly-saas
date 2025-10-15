@echo off
echo 🔄 Adding changes...
git add .

echo.
echo 🔄 Committing...
git commit -m "Fix: Remove old SQLite files and temporarily disable campaign runners"

echo.
echo 🚀 Pushing to GitHub...
git push origin main

echo.
echo ✅ Done!
echo.
pause
