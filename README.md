# 🚀 Reachly SaaS - Twitter Automation Platform

[![Deploy on Render](https://img.shields.io/badge/Deploy-Render-success)](https://render.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

**منصة متكاملة لأتمتة التواصل على Twitter/X**

---

## ✨ الميزات

- ✅ **إدارة حسابات Twitter متعددة** مع تشفير AES-256
- ✅ **حملات الرسائل المباشرة** مع أتمتة كاملة
- ✅ **حملات المتابعة** التلقائية
- ✅ **استخراج المتابعين** من أي حساب
- ✅ **نظام Pacing & Retry** لمنع الحظر
- ✅ **نظام اشتراكات** (Free, Starter, Pro)
- ✅ **لوحة تحكم للمدير**

---

## 🚀 النشر السريع على Render

### المتطلبات:
- حساب GitHub
- حساب Render (مجاني)

### الخطوات:

1. **Fork المشروع** أو استخدمه مباشرة

2. **اذهب إلى Render:** https://render.com

3. **أنشئ Web Service:**
   - New → Web Service
   - Connect Repository: `codeestore20-maker/reachly-saas`
   - Name: `reachly-saas`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **أضف PostgreSQL:**
   - New → PostgreSQL
   - Name: `reachly-postgres`

5. **أضف Redis:**
   - New → Redis (Key Value)
   - Name: `reachly-redis`

6. **أضف متغيرات البيئة:**
   ```env
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=<generate-with-crypto>
   COOKIE_ENCRYPTION_KEY=<generate-with-crypto>
   DATABASE_URL=<from-postgres>
   REDIS_URL=<from-redis>
   ```

7. **توليد المفاتيح:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

8. **أضف FRONTEND_URL** بعد أول نشر:
   ```env
   FRONTEND_URL=https://your-app.onrender.com
   ```

📖 **دليل مفصل:** [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)

---

## 💻 التطوير المحلي

### المتطلبات:
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### الخطوات:

```bash
# 1. استنساخ المشروع
git clone https://github.com/codeestore20-maker/reachly-saas.git
cd reachly-saas

# 2. تثبيت المكتبات
npm install

# 3. إعداد البيئة
cp .env.example .env.local
# عدّل .env.local وأضف المفاتيح

# 4. تشغيل التطبيق
npm run dev:all
```

---

## 📊 نظام الاشتراكات

| الخطة | السعر | الحسابات | الرسائل/شهر | المتابعات/شهر |
|-------|-------|----------|-------------|---------------|
| **Free** | مجاني | 1 | 100 | 50 |
| **Starter** | $29 | 3 | 1,000 | 500 |
| **Pro** | $79 | 10 | 10,000 | 5,000 |

---

## 🏗️ البنية التقنية

### Frontend:
- React 18 + TypeScript
- Vite
- TailwindCSS + shadcn/ui
- React Router
- Tanstack Query

### Backend:
- Node.js + Express
- TypeScript
- PostgreSQL
- Redis + Bull
- JWT + bcrypt

---

## 🔐 الأمان

- **AES-256** لتشفير كوكيز Twitter
- **bcrypt** لتشفير كلمات المرور
- **JWT** للمصادقة
- **Rate Limiting** لمنع الإساءة
- **HTTPS** إجباري

---

## 👤 حساب المدير الافتراضي

```
البريد: admin@reachly.com
كلمة المرور: Balawi123
```

**⚠️ غيّر كلمة المرور فوراً بعد أول تسجيل دخول!**

---

## 📚 التوثيق

- **[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)** - دليل النشر الكامل
- **[QUICK_START.md](QUICK_START.md)** - البدء السريع
- **[README_AR.md](README_AR.md)** - الدليل بالعربية
- **[docs/](docs/)** - التوثيق التقني

---

## ⚠️ تحذير قانوني

هذا المشروع للأغراض التعليمية فقط. استخدام أتمتة Twitter قد يخالف شروط الخدمة. استخدمه على مسؤوليتك الخاصة.

---

## 📄 الترخيص

MIT License - استخدم المشروع بحرية للتعلم والتطوير.

---

## 🔗 الروابط

- **GitHub:** https://github.com/codeestore20-maker/reachly-saas
- **Live Demo:** https://reachly-saas.onrender.com
- **Issues:** https://github.com/codeestore20-maker/reachly-saas/issues

---

**© 2025 Reachly Team. جميع الحقوق محفوظة.**
