# 🔐 Encryption Key Management Guide

## Problem: Accounts Disconnected After Server Restart

### Symptoms:
- Server restarts (due to inactivity, crash, or redeployment)
- All accounts show "active" but fail to work
- Error: "Failed to decrypt data. The encryption key may have changed."
- Users must re-add all accounts

### Root Cause:

**In render.yaml:**
```yaml
- key: COOKIE_ENCRYPTION_KEY
  generateValue: true  ← Problem!
```

`generateValue: true` means Render generates a **NEW random value** on every deployment/restart.

**What happens:**
1. Server starts with Key A
2. User adds account → encrypted with Key A
3. Server restarts → Render generates Key B
4. Try to decrypt account → fails (encrypted with A, trying to decrypt with B)

---

## ✅ Solution 1: Fixed Encryption Key (Recommended)

### For Render Deployment:

**Step 1: Generate a permanent key**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Step 2: Set in Render Dashboard**
1. Go to your service → Environment
2. Find `COOKIE_ENCRYPTION_KEY`
3. Click Edit
4. Paste your generated key
5. **Save** (don't use "Generate Value")

**Step 3: Update render.yaml**
```yaml
- key: COOKIE_ENCRYPTION_KEY
  sync: false  ← Changed from generateValue: true
```

**Step 4: Redeploy**
```bash
git add render.yaml
git commit -m "fix: Use fixed encryption key"
git push
```

### Important Notes:
- ⚠️ **Backup your key!** Store it securely
- ⚠️ **Never commit the key to git**
- ⚠️ If you lose the key, all encrypted data is lost
- ✅ Key persists across restarts

---

## ✅ Solution 2: Key Rotation with Backward Compatibility

If you already have encrypted data and the key changed, use this solution.

### How It Works:

The system now supports **multiple encryption keys**:
- **Current key:** Used for new encryptions
- **Old keys:** Used to decrypt old data

### Setup:

**Step 1: Get your old key (if you have it)**
- Check Render logs for the old key
- Or check your backup

**Step 2: Set environment variables**
```bash
# Current key (new)
COOKIE_ENCRYPTION_KEY=new_key_here

# Old keys (comma-separated)
OLD_ENCRYPTION_KEYS=old_key_1,old_key_2,old_key_3
```

**Step 3: System behavior**
```
Decrypt attempt:
1. Try current key → Success? Return data
2. Try old key #1 → Success? Return data + warning
3. Try old key #2 → Success? Return data + warning
4. All failed → Error
```

### Migration Strategy:

**Option A: Gradual Migration**
1. Set OLD_ENCRYPTION_KEYS with old key
2. Users can still use old accounts
3. New accounts use new key
4. Eventually, ask users to re-add accounts

**Option B: Force Re-add**
1. Don't set OLD_ENCRYPTION_KEYS
2. All users must re-add accounts
3. Clean start with new key

---

## 🔍 Troubleshooting

### Check Current Key:
```bash
# In Render logs, look for:
🔑 Encryption key loaded: abc12345...
```

### Verify Key Length:
```bash
# Should be 64 characters (32 bytes in hex)
echo -n "your_key_here" | wc -c
# Output should be: 64
```

### Test Encryption/Decryption:
```javascript
// In Node.js console
const crypto = require('crypto');
const key = Buffer.from('your_key_here', 'hex');
const iv = crypto.randomBytes(16);

// Encrypt
const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
let encrypted = cipher.update('test', 'utf8', 'hex');
encrypted += cipher.final('hex');
const result = iv.toString('hex') + ':' + encrypted;
console.log('Encrypted:', result);

// Decrypt
const parts = result.split(':');
const ivDec = Buffer.from(parts[0], 'hex');
const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivDec);
let decrypted = decipher.update(parts[1], 'hex', 'utf8');
decrypted += decipher.final('utf8');
console.log('Decrypted:', decrypted); // Should be: test
```

---

## 📋 Best Practices

### 1. Key Management
- ✅ Use a password manager to store keys
- ✅ Backup keys in multiple secure locations
- ✅ Document which key is used in which environment
- ❌ Never commit keys to git
- ❌ Never share keys in plain text

### 2. Production Setup
```bash
# Generate key once
KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Save to password manager
echo "Production Key: $KEY" >> secure_vault.txt

# Set in Render
# (Do this manually in dashboard)
```

### 3. Development Setup
```bash
# .env.local (gitignored)
COOKIE_ENCRYPTION_KEY=dev_key_here

# Different key for each environment
# Dev: dev_key_123...
# Staging: staging_key_456...
# Production: prod_key_789...
```

### 4. Key Rotation Plan
```
Year 1: Key A (current)
Year 2: Key B (current), Key A (old)
Year 3: Key C (current), Key B (old), Key A (removed)
```

---

## 🚨 Emergency Recovery

### If Key Is Lost:

**Option 1: Restore from Backup**
1. Find key in backup
2. Set in environment
3. Restart server

**Option 2: Accept Data Loss**
1. Generate new key
2. Clear encrypted data:
   ```sql
   DELETE FROM accounts;
   ```
3. Users re-add accounts

**Option 3: Partial Recovery**
1. Check Render logs for old key
2. Set as OLD_ENCRYPTION_KEYS
3. Some data may be recoverable

---

## 📊 Monitoring

### Log Messages to Watch:

**Good:**
```
✅ Using COOKIE_ENCRYPTION_KEY from environment
🔑 Encryption key loaded: abc12345...
```

**Warning:**
```
⚠️  Decrypted with old key #1. Consider re-encrypting this data.
```

**Bad:**
```
❌ Decryption failed with all available keys
⚠️  COOKIE_ENCRYPTION_KEY not found in environment
```

### Metrics to Track:
- Number of decryption failures
- Number of old key usages
- Account re-add rate

---

## 🔄 Migration Checklist

When changing encryption key:

- [ ] Backup current key
- [ ] Generate new key
- [ ] Set OLD_ENCRYPTION_KEYS with current key
- [ ] Set COOKIE_ENCRYPTION_KEY with new key
- [ ] Test with one account
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Notify users if needed
- [ ] After 30 days, remove old key

---

## 📞 Support

If you encounter encryption issues:

1. Check Render environment variables
2. Verify key length (64 characters)
3. Check logs for specific error
4. Try OLD_ENCRYPTION_KEYS if key changed
5. Last resort: Ask users to re-add accounts

---

**Remember:** The encryption key is the most critical piece of data in the system. Treat it like a password!
