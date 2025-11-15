# 📝 Changelog

All notable changes to Reachly SaaS will be documented in this file.

---

## [2.0.0] - 2025-11-15

### 🎉 Major Release - DM System Overhaul

#### ✨ Added
- **Working DM System:** Complete rewrite using REST API v1.1
- **Smart Retry Logic:** Configurable retry attempts (0-5)
- **Permanent Error Detection:** Automatically skips 403 privacy errors
- **User-Friendly Error Messages:** Clear explanations for failures
- **Migration System:** Auto-updates old campaigns to new defaults
- **Comprehensive Documentation:** New DM_SYSTEM.md guide

#### 🔧 Fixed
- **DM Sending:** Now uses correct `/direct_messages/events/new.json` endpoint
- **Retry Attempts:** Properly respects user configuration (0 = no retries)
- **403 Errors:** No longer retries when user privacy prevents DMs
- **Status Management:** Uses 'skipped' status for permanent errors
- **Default Values:** Changed retry attempts default from 2 to 0

#### 🔄 Changed
- **API Endpoint:** Switched from GraphQL to REST API v1.1
- **Error Handling:** Improved error messages and status codes
- **Database Defaults:** Updated `pacing_retry_attempts` default to 0
- **Campaign Logic:** Better separation of temporary vs permanent failures

#### 📚 Documentation
- Updated README.md with current features
- Created DM_SYSTEM.md with complete guide
- Updated TROUBLESHOOTING.md with new error codes
- Added CHANGELOG.md for version tracking
- Removed outdated README_AR.md

---

## [1.5.0] - 2025-11-14

### 🚀 Twitter API Integration

#### ✨ Added
- **Account Validation:** Working GraphQL integration
- **Follower Extraction:** Extract followers from any public account
- **Follow System:** Automated following with pacing
- **Browser Headers:** Complete Chrome browser simulation

#### 🔧 Fixed
- **Query IDs:** Updated to working IDs (Nov 2025)
- **Cookie Parsing:** Support for EditThisCookie format
- **User Lookup:** Proper username validation

---

## [1.0.0] - 2025-11-01

### 🎉 Initial Release

#### ✨ Features
- User authentication (signup/login)
- Multi-account management
- Campaign creation wizard
- Basic DM sending
- Follow campaigns
- Admin dashboard
- Subscription system (Free, Starter, Pro)
- PostgreSQL + Redis integration
- Render.com deployment ready

#### 🏗️ Tech Stack
- React 18 + TypeScript
- Node.js + Express
- PostgreSQL + Redis
- TailwindCSS + shadcn/ui
- Bull queue system

---

## Version History Summary

| Version | Date | Key Feature |
|---------|------|-------------|
| 2.0.0 | 2025-11-15 | Working DM system with smart retry |
| 1.5.0 | 2025-11-14 | Twitter API integration |
| 1.0.0 | 2025-11-01 | Initial release |

---

## Upgrade Guide

### From 1.x to 2.0

#### Database Changes
The system will automatically:
1. Update `pacing_retry_attempts` default to 0
2. Update existing campaigns with retry_attempts = 2 to 0

No manual intervention required.

#### API Changes
- DM endpoint changed (internal only, no user impact)
- Error messages improved
- New status type: 'skipped'

#### Configuration Changes
- Default retry attempts: 2 → 0
- Recommended to review campaign settings

---

## Roadmap

### v2.1.0 (Planned)
- [ ] Message templates system
- [ ] Conversation tracking
- [ ] Reply detection
- [ ] Advanced analytics

### v2.2.0 (Planned)
- [ ] A/B testing for messages
- [ ] Scheduled campaigns
- [ ] CSV import/export
- [ ] Webhook integrations

### v3.0.0 (Future)
- [ ] AI-powered targeting
- [ ] Image/GIF support in DMs
- [ ] CRM integration
- [ ] Mobile app

---

## Breaking Changes

### v2.0.0
- **Retry Attempts Default:** Changed from 2 to 0
  - **Impact:** New campaigns won't retry by default
  - **Migration:** Existing campaigns auto-updated
  - **Action:** Review and adjust if needed

---

## Bug Fixes by Version

### v2.0.0
- Fixed: DM sending always failed with 415/404/400 errors
- Fixed: Retry attempts ignored user configuration
- Fixed: 403 errors retried unnecessarily
- Fixed: Confusing error messages

### v1.5.0
- Fixed: Account validation always failed
- Fixed: Cookie parsing errors
- Fixed: Query ID expired errors

### v1.0.0
- Initial release, no prior bugs

---

## Security Updates

### v2.0.0
- Enhanced cookie encryption validation
- Improved error message sanitization
- Better rate limiting

### v1.0.0
- AES-256 cookie encryption
- JWT authentication
- bcrypt password hashing

---

## Performance Improvements

### v2.0.0
- Reduced unnecessary API calls
- Better error detection (no retries for permanent errors)
- Optimized database queries

---

## Contributors

- **Lead Developer:** Kiro AI Assistant
- **Project Owner:** codeestore20-maker
- **Community:** GitHub contributors

---

## License

MIT License - See LICENSE file for details

---

## Support

- **Documentation:** [docs/](.)
- **Issues:** [GitHub Issues](https://github.com/codeestore20-maker/reachly-saas/issues)
- **Email:** support@reachly.com

---

**Note:** This changelog follows [Keep a Changelog](https://keepachangelog.com/) format and [Semantic Versioning](https://semver.org/).
