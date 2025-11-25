# 🔐 Encryption Key Setup - Quick Guide

## ⚠️ Problem: Accounts disconnected after server restart

**Cause:** Encryption key changes on every restart

**Solution:** Set a fixed key manually in Render Dashboard

---

## ✅ Step-by-Step Fix (5 minutes)

### Step 1: Generate a Fixed Key

On your computer, run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**⚠️ SAVE THIS KEY!** You'll need it if you ever migrate servers.

---

### Step 2: Set Key in Render Dashboard

1. Go to: https://dashboard.render.com
2. Select: **reachly-saas** (your service)
3. Click: **Environment** tab
4. Find: `COOKIE_ENCRYPTION_KEY`
5. Click: **Edit** (pencil icon)
6. Paste: Your generated key
7. Click: **Save Changes**

**The service will restart automatically.**

---

### Step 3: Clean Old Accounts

**Option A: Delete from website (easiest)**
1. Go to your website → Accounts page
2. Delete each account manually

**Option B: Delete from database**
1. In Render Dashboard → reachly-postgres
2. Click: Connect → External Connection
3. Use any PostgreSQL client
4. Run: `DELETE FROM accounts;`

---

### Step 4: Re-add Accounts

1. Go to: Accounts page
2. Click: **Add Account**
3. Enter username and cookies
4. **Done!** Now encrypted with the fixed key

---

## ✅ Verification

After setup, test:

1. Add an account
2. Create a small campaign
3. Run it successfully
4. **Restart the service** (in Render Dashboard)
5. Campaign should still work ✅

---

## 🔒 Key Management

### Where to Save Your Key:
- ✅ Password manager (1Password, LastPass, etc.)
- ✅ Secure notes app
- ✅ Encrypted file on your computer
- ❌ Never commit to git
- ❌ Never share in plain text

### If You Lose the Key:
1. All encrypted data is lost
2. Generate a new key
3. Delete all accounts
4. Users re-add accounts

### Key Rotation (optional):
If you want to change the key later:
1. Set `OLD_ENCRYPTION_KEYS` with current key
2. Set `COOKIE_ENCRYPTION_KEY` with new key
3. System will decrypt old data with old key
4. Ask users to re-add accounts gradually

---

## 🎯 Why This Works

**Before (broken):**
```
Server starts → Render generates random key → Encrypts data
Server restarts → Render generates NEW random key → Can't decrypt old data ❌
```

**After (fixed):**
```
Server starts → Uses your fixed key from Dashboard → Encrypts data
Server restarts → Uses SAME fixed key from Dashboard → Decrypts successfully ✅
```

---

## 📞 Troubleshooting

### Still getting "Failed to decrypt" error?

**Check:**
1. Did you set the key in Render Dashboard?
2. Did you delete old accounts?
3. Did you re-add accounts after setting the key?

**Verify key is set:**
- In Render Dashboard → Environment
- `COOKIE_ENCRYPTION_KEY` should have a value
- Should be 64 characters long

### Key keeps changing?

**Make sure:**
- You removed `generateValue: true` from render.yaml ✅
- You set the key MANUALLY in Dashboard ✅
- You saved the changes ✅

---

## ✨ Done!

Your encryption key is now fixed and will persist across:
- ✅ Server restarts
- ✅ Redeployments
- ✅ Service updates
- ✅ Inactivity periods

**The key only changes if YOU change it manually.**

---

**Need help?** Check `docs/ENCRYPTION_KEY_MANAGEMENT.md` for detailed documentation.
