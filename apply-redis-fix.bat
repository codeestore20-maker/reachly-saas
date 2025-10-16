@echo off
echo ========================================
echo   Redis Connection Fix
echo ========================================
echo.
echo المشكلة: Private URL لا يعمل
echo الحل: استخدم Public URL
echo.
echo ========================================
echo   الخطوات:
echo ========================================
echo.
echo 1. اذهب إلى Railway Dashboard
echo 2. افتح Web Service (reachly-saas)
echo 3. اضغط Variables tab
echo 4. احذف REDIS_URL الحالي
echo 5. اضغط + New Variable
echo 6. اختر Reference
echo 7. Service: Redis
echo 8. Variable: REDIS_PUBLIC_URL
echo 9. Name: REDIS_URL
echo 10. Save
echo.
echo ========================================
echo   أو أضفه يدوياً:
echo ========================================
echo.
echo Name: REDIS_URL
echo Value: redis://default:VNKQMwodWVEuqnDhvuavxcGQvCJjZCha@interchange.proxy.rlwy.net:48488
echo.
echo ========================================
echo   النتيجة المتوقعة:
echo ========================================
echo.
echo ✅ Connected to Redis
echo 🚀 Campaign queue initialized
echo 🚀 Follow queue initialized
echo.
echo ========================================
git add .
git commit -m "Add Redis connection fix guide"
git push origin main
echo.
echo ✅ Fix guide pushed to repository!
echo.
pause
