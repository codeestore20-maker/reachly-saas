# 🔧 Troubleshooting Guide

Common issues and their solutions for Reachly SaaS.

---

## 🔐 Account Issues

### ❌ Account Shows "Invalid"

#### Possible Causes:

**1. Expired Cookies**
- **Symptoms:** Account was valid, now shows invalid
- **Solution:**
  1. Log out of Twitter
  2. Log in again
  3. Get fresh cookies
  4. Update account in Reachly

**2. Wrong Username**
- **Symptoms:** Validation fails immediately
- **Solution:**
  - Enter username WITHOUT @
  - Example: `oblawj` not `@oblawj`
  - No spaces before/after

**3. Protected/Suspended Account**
- **Symptoms:** "User not found" error
- **Solution:**
  - Verify account is active on Twitter
  - Check if account is public (not protected)
  - Ensure account is not suspended

**4. Query ID Expired**
- **Symptoms:** All accounts fail validation
- **Solution:**
  - This is rare (Query IDs updated Nov 2025)
  - Check GitHub for updates
  - Report issue if widespread

---

## 📨 DM Campaign Issues

### ❌ All DMs Fail with 403

**Error Message:**
```
User privacy settings prevent receiving messages from non-followers
```

#### Solutions:

**1. Follow Users First (Recommended)**
```
Step 1: Create Follow Campaign
Step 2: Wait 24-48 hours
Step 3: Create DM Campaign
```

**2. Target Your Followers**
- Extract followers from your own account
- They can receive your DMs

**3. Improve Account Reputation**
- Use account normally for a few days
- Engage with tweets
- Build follower base

**4. Check Account Status**
- Verify account can send DMs manually
- Check for restrictions in Twitter settings

### ❌ DMs Not Received

**Symptoms:** Status shows "sent" but recipient didn't receive

#### Possible Causes:

**1. Filtered as Spam**
- **Solution:**
  - Improve message quality
  - Personalize with {{name}}
  - Avoid spam keywords
  - Don't include links initially

**2. Message Requests Folder**
- **Solution:**
  - Recipient needs to check "Message Requests"
  - Follow user first to avoid this

**3. Account Shadow-Banned**
- **Solution:**
  - Test by sending to your own account
  - Check account health
  - Reduce activity if suspected

### ❌ Rate Limit Errors (429)

**Error Message:**
```
Rate limit exceeded
```

#### Solutions:

**1. Reduce Speed**
```typescript
// Change from:
perMinute: 5
delayMin: 10
delayMax: 20

// To:
perMinute: 2
delayMin: 20
delayMax: 40
```

**2. Lower Daily Cap**
```typescript
// Change from:
dailyCap: 200

// To:
dailyCap: 50
```

**3. Add Delays Between Campaigns**
- Wait 1-2 hours between campaigns
- Don't run multiple campaigns simultaneously

---

## 🎯 Follow Campaign Issues

### ❌ Follows Fail

**Common Errors:**

**1. Already Following**
- **Solution:** System should skip automatically
- Check if target is already followed

**2. Protected Account**
- **Solution:** System will send follow request
- Wait for approval

**3. Rate Limit**
- **Solution:** Same as DM rate limits
- Reduce speed and daily cap

---

## 🔄 Campaign Status Issues

### ❌ Campaign Stuck in "Active"

**Symptoms:** Campaign shows active but not processing

#### Solutions:

**1. Check Targets**
```sql
-- All targets processed?
SELECT status, COUNT(*) 
FROM targets 
WHERE campaign_id = X 
GROUP BY status;
```

**2. Restart Campaign**
- Pause campaign
- Wait 10 seconds
- Start again

**3. Check Server Logs**
- Look for errors in console
- Check Render logs if deployed

### ❌ Campaign Won't Start

**Symptoms:** Click start, nothing happens

#### Solutions:

**1. Check Account Status**
- Ensure account is valid
- Re-validate if needed

**2. Check Targets**
- Ensure campaign has targets
- Minimum 1 target required

**3. Check Browser Console**
- Open DevTools (F12)
- Look for errors
- Report if found

---

## 🗄️ Database Issues

### ❌ "Database connection failed"

#### Solutions:

**1. Check DATABASE_URL**
```bash
# Verify environment variable is set
echo $DATABASE_URL
```

**2. Check PostgreSQL Status**
- Ensure database is running
- Check Render dashboard if deployed

**3. Check Connection String Format**
```
postgresql://user:password@host:port/database
```

### ❌ "Redis connection failed"

#### Solutions:

**1. Check REDIS_URL**
```bash
echo $REDIS_URL
```

**2. Check Redis Status**
- Ensure Redis is running
- Check Render dashboard if deployed

---

## 🔑 Authentication Issues

### ❌ "Invalid token" or "Unauthorized"

#### Solutions:

**1. Clear Browser Cache**
- Clear cookies and cache
- Log out and log in again

**2. Check JWT_SECRET**
- Ensure environment variable is set
- Must be same across restarts

**3. Token Expired**
- Tokens expire after 7 days
- Log in again to get new token

### ❌ Can't Sign Up

**Symptoms:** Signup fails with error

#### Solutions:

**1. Email Already Exists**
- Use different email
- Or log in with existing account

**2. Weak Password**
- Minimum 6 characters required
- Use mix of letters and numbers

**3. Database Error**
- Check database connection
- Check server logs

---

## 🚀 Deployment Issues

### ❌ Build Fails on Render

#### Solutions:

**1. Check Build Command**
```bash
npm install && npm run build
```

**2. Check Node Version**
- Ensure Node.js 18+ in render.yaml
- Or set in Render dashboard

**3. Check Dependencies**
```bash
# Locally test build
npm install
npm run build
```

### ❌ App Crashes After Deploy

#### Solutions:

**1. Check Environment Variables**
- All required vars set?
- DATABASE_URL correct?
- REDIS_URL correct?

**2. Check Logs**
```bash
# In Render dashboard
Logs → View logs
```

**3. Check Start Command**
```bash
npm start
```

---

## 📊 Performance Issues

### ❌ Slow Response Times

#### Solutions:

**1. Check Database**
- Add indexes if needed
- Check query performance

**2. Check Redis**
- Ensure Redis is running
- Check memory usage

**3. Upgrade Plan**
- Free tier has limitations
- Consider paid plan for better performance

### ❌ High Memory Usage

#### Solutions:

**1. Check Campaign Count**
- Too many active campaigns?
- Pause unused campaigns

**2. Check Target Count**
- Large campaigns use more memory
- Split into smaller campaigns

**3. Restart Service**
- Sometimes helps clear memory
- Render auto-restarts if needed

---

## 🐛 Common Errors

### Error: "Cannot read property 'id' of undefined"

**Cause:** Missing user data

**Solution:**
- Log out and log in again
- Clear browser cache

### Error: "Network request failed"

**Cause:** Backend not responding

**Solution:**
- Check if backend is running
- Check FRONTEND_URL in env vars
- Check CORS settings

### Error: "Unexpected token < in JSON"

**Cause:** Backend returning HTML instead of JSON

**Solution:**
- Check API endpoint URLs
- Ensure backend is running
- Check for 404 errors

---

## 📞 Getting Help

### Before Reporting Issues:

1. **Check This Guide** - Most issues covered here
2. **Check Logs** - Look for error messages
3. **Test Locally** - Does it work in development?
4. **Check GitHub Issues** - Similar issues reported?

### When Reporting Issues:

Include:
- **Error Message** - Exact text
- **Steps to Reproduce** - What you did
- **Expected Behavior** - What should happen
- **Actual Behavior** - What actually happened
- **Environment** - Local or deployed?
- **Browser/OS** - Chrome on Windows, etc.
- **Screenshots** - If relevant

### Contact:

- **GitHub Issues:** [Report Issue](https://github.com/codeestore20-maker/reachly-saas/issues)
- **Email:** support@reachly.com
- **Documentation:** [docs/](.)

---

## 🔍 Debug Mode

### Enable Detailed Logging:

**Backend:**
```typescript
// In server/logger.ts
level: 'debug'  // Change from 'info'
```

**Frontend:**
```typescript
// In browser console
localStorage.setItem('debug', 'true');
```

### Check Logs:

**Local:**
```bash
# Backend logs in terminal
npm run dev:server

# Frontend logs in browser console (F12)
```

**Deployed (Render):**
```
Dashboard → Your Service → Logs
```

---

## 📚 Additional Resources

- **[DM System Guide](DM_SYSTEM.md)** - How DMs work
- **[Pacing & Retry](PACING_AND_RETRY_SYSTEM.md)** - Rate limiting details
- **[API Docs](API_DOCS.md)** - API reference
- **[Project Docs](PROJECT_DOCUMENTATION.md)** - Technical details

---

## ✅ Quick Checklist

Before asking for help, verify:

- [ ] Environment variables are set correctly
- [ ] Database is connected and running
- [ ] Redis is connected and running
- [ ] Account cookies are valid and fresh
- [ ] Username entered without @
- [ ] Campaign has targets
- [ ] Pacing settings are reasonable
- [ ] No rate limit errors in logs
- [ ] Browser console shows no errors
- [ ] Latest version deployed

---

**Remember:** Most issues are configuration-related. Double-check your settings before reporting bugs!
