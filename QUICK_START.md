# ⚡ البدء السريع - Reachly SaaS

## 🎯 نشر على Render في 10 دقائق

---

## الخطوة 1: إنشاء Web Service

1. اذهب إلى https://render.com
2. New → **Web Service**
3. Connect Repository: `codeestore20-maker/reachly-saas`
4. الإعدادات:
   ```
   Name: reachly-saas
   Region: Frankfurt
   Branch: main
   Build Command: npm install && npm run build
   Start Command: npm start
   Plan: Free
   ```

---

## الخطوة 2: إضافة PostgreSQL

1. New → **PostgreSQL**
2. الإعدادات:
   ```
   Name: reachly-postgres
   Database: reachly
   Region: Frankfurt
   Plan: Free
   ```

---

## الخطوة 3: إضافة Redis

1. New → **Redis** (Key Value)
2. الإعدادات:
   ```
   Name: reachly-redis
   Region: Frankfurt
   Plan: Free
   ```

---

## الخطوة 4: إضافة متغيرات البيئة

في Web Service → Environment:

### 1. المتغيرات الأساسية:
```env
NODE_ENV=production
PORT=3001
```

### 2. توليد المفاتيح:
```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Cookie Encryption Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

أضفهم:
```env
JWT_SECRET=<المفتاح-الأول>
COOKIE_ENCRYPTION_KEY=<المفتاح-الثاني>
```

### 3. ربط القواعد:
```env
DATABASE_URL=<من-PostgreSQL-Internal-Connection-String>
REDIS_URL=<من-Redis-Internal-Connection-String>
```

---

## الخطوة 5: النشر الأول

1. احفظ المتغيرات
2. انتظر النشر (2-3 دقائق)
3. افتح: `https://your-app.onrender.com/health`

يجب أن ترى:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected"
}
```

---

## الخطوة 6: إضافة FRONTEND_URL

1. انسخ رابط التطبيق
2. أضف متغير:
   ```env
   FRONTEND_URL=https://your-app.onrender.com
   ```
3. احفظ (سيعيد النشر تلقائياً)

---

## ✅ جاهز!

افتح التطبيق وسجل دخول:
```
البريد: admin@reachly.com
كلمة المرور: Balawi123
```

**⚠️ غيّر كلمة المرور فوراً!**

---

## 🆘 مشاكل شائعة

### CORS Error
- أضف `FRONTEND_URL` في المتغيرات

### Database Error
- تحقق من `DATABASE_URL`
- استخدم Internal Connection String

### Redis Error
- تحقق من `REDIS_URL`
- استخدم Internal Connection String

---

**للمزيد:** [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)
