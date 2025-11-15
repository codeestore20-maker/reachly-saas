# 🚀 Reachly SaaS - Twitter Automation Platform

[![Deploy on Render](https://img.shields.io/badge/Deploy-Render-success)](https://render.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

**Complete Twitter/X automation platform for DMs and Follow campaigns**

---

## ✨ Features

### Core Functionality
- ✅ **Multi-Account Management** - Manage multiple Twitter accounts with AES-256 encryption
- ✅ **DM Campaigns** - Automated direct message campaigns with smart targeting
- ✅ **Follow Campaigns** - Automated following with customizable pacing
- ✅ **Follower Extraction** - Extract followers from any public account
- ✅ **Smart Retry System** - Configurable retry attempts with permanent error detection
- ✅ **Rate Limiting Protection** - Advanced pacing system to prevent bans

### Platform Features
- ✅ **Subscription System** - Free, Starter, and Pro plans
- ✅ **Admin Dashboard** - Complete platform management
- ✅ **Real-time Analytics** - Track campaign performance live
- ✅ **User-friendly UI** - Modern, responsive interface

---

## 🚀 Quick Deploy on Render

### Prerequisites:
- GitHub account
- Render account (free tier available)

### Steps:

1. **Fork or use this repository**

2. **Go to Render:** https://render.com

3. **Create Web Service:**
   - New → Web Service
   - Connect Repository: `codeestore20-maker/reachly-saas`
   - Name: `reachly-saas`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **Add PostgreSQL:**
   - New → PostgreSQL
   - Name: `reachly-postgres`

5. **Add Redis:**
   - New → Redis (Key Value)
   - Name: `reachly-redis`

6. **Add Environment Variables:**
   ```env
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=<generate-with-crypto>
   COOKIE_ENCRYPTION_KEY=<generate-with-crypto>
   DATABASE_URL=<from-postgres>
   REDIS_URL=<from-redis>
   ```

7. **Generate Keys:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

8. **Add FRONTEND_URL** after first deployment:
   ```env
   FRONTEND_URL=https://your-app.onrender.com
   ```

📖 **Detailed Guide:** [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)

---

## 💻 Local Development

### Prerequisites:
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Setup:

1. **Clone repository:**
   ```bash
   git clone https://github.com/codeestore20-maker/reachly-saas.git
   cd reachly-saas
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup environment:**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your credentials.

4. **Start development:**
   ```bash
   npm run dev:all
   ```

   This starts:
   - Frontend: `http://localhost:8080`
   - Backend API: `http://localhost:3001`

---

## 📚 Documentation

- **[Quick Start Guide](QUICK_START.md)** - Get started in 10 minutes
- **[Deployment Guide](RENDER_DEPLOYMENT.md)** - Detailed Render deployment
- **[Project Documentation](docs/PROJECT_DOCUMENTATION.md)** - Complete technical docs
- **[API Documentation](docs/API_DOCS.md)** - API endpoints reference
- **[DM System](docs/DM_SYSTEM.md)** - How the DM system works
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Changelog](docs/CHANGELOG.md)** - Version history

---

## 🏗️ Tech Stack

### Frontend
- React 18 + TypeScript
- TailwindCSS + shadcn/ui
- React Router v6
- React Query (TanStack Query)
- Recharts for analytics

### Backend
- Node.js + Express + TypeScript
- PostgreSQL (database)
- Redis (queue management)
- Bull (job processing)
- Winston (logging)

### Security
- JWT authentication
- AES-256 encryption for cookies
- bcrypt password hashing
- Rate limiting
- CORS protection

---

## 🔐 Security Features

- **Cookie Encryption:** All Twitter cookies encrypted with AES-256
- **Secure Authentication:** JWT tokens with httpOnly cookies
- **Password Security:** bcrypt hashing with salt rounds
- **Rate Limiting:** Protection against abuse
- **Input Validation:** All inputs sanitized
- **CORS Protection:** Configured for production

---

## � System Architecture

```
┌─────────────┐
│   Client    │
│  (React)    │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│   Express   │
│   Server    │
└──────┬──────┘
       │
       ├──→ PostgreSQL (Data)
       ├──→ Redis (Queue)
       └──→ Twitter API
```

---

## 🎯 Key Features Explained

### Smart DM System
- REST API v1.1 integration
- Automatic retry with configurable attempts
- Permanent error detection (403 privacy settings)
- User-friendly error messages
- Status tracking (sent, failed, skipped)

### Follow System
- Automated following with pacing
- Retry mechanism for failed attempts
- Daily caps and rate limiting
- Real-time progress tracking

### Pacing & Protection
- Messages per minute control
- Delay between actions (min/max)
- Daily caps per campaign
- Retry attempts configuration
- Automatic ban prevention

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📝 License

This project is licensed under the MIT License.

---

## 🆘 Support

- **Documentation:** Check the [docs](docs/) folder
- **Issues:** Open an issue on GitHub
- **Email:** support@reachly.com

---

## 🎉 Acknowledgments

Built with ❤️ using modern web technologies.

Special thanks to:
- Twitter/X API
- Render.com for hosting
- Open source community

---

**⚠️ Disclaimer:** Use this tool responsibly and in accordance with Twitter's Terms of Service. Automated actions may violate Twitter's policies if misused.
