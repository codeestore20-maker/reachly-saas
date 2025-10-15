@echo off
git add .
git commit -m "Fix: Stop Redis connection attempts when REDIS_URL is not set"
git push origin main
echo.
echo ✅ Redis errors should be gone now!
pause
