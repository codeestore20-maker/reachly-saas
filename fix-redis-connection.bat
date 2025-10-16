@echo off
git add .
git commit -m "Improve Redis connection handling and add setup guide"
git push origin main
echo.
echo ✅ Redis connection improved!
echo.
echo 📖 Check REDIS_SETUP.md for instructions
pause
