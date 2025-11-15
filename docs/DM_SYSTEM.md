# 📨 Direct Message System - Complete Guide

## Overview

The DM system in Reachly uses Twitter's REST API v1.1 to send direct messages. This document explains how it works, the challenges we solved, and best practices.

---

## How It Works

### 1. Account Validation

When you add a Twitter account:

```typescript
validateTwitterAccount(cookies, username)
  ↓
  Uses GraphQL: UserByScreenName
  ↓
  Verifies username matches
  ↓
  Returns: { valid, username, avatar }
```

**Query ID Used:** `ZHSN3WlvahPKVvUxVQbg1A` (Updated Nov 2025)

### 2. Sending DMs

```typescript
sendDM(cookies, recipientUsername, message)
  ↓
  1. Get user ID via getUserId()
  ↓
  2. Send via REST API v1.1
  ↓
  Endpoint: /direct_messages/events/new.json
  ↓
  Returns: { success, error }
```

**API Endpoint:**
```
POST https://x.com/i/api/1.1/direct_messages/events/new.json
```

**Request Format:**
```json
{
  "event": {
    "type": "message_create",
    "message_create": {
      "target": {
        "recipient_id": "USER_ID"
      },
      "message_data": {
        "text": "Your message here"
      }
    }
  }
}
```

---

## Error Handling

### Common Errors

#### 1. **403 - Cannot Send Messages**
```json
{
  "errors": [{
    "code": 349,
    "message": "You cannot send messages to this user."
  }]
}
```

**Reason:** User privacy settings prevent messages from non-followers

**Solution:** 
- Follow the user first
- Wait 1-2 days
- Then send DM

**System Behavior:**
- Status set to `skipped`
- No retry attempts
- Friendly error message shown

#### 2. **404 - User Not Found**
```json
{
  "errors": [{
    "code": 50,
    "message": "User not found."
  }]
}
```

**Reason:** Username doesn't exist or account deleted

**Solution:** Verify username is correct

#### 3. **429 - Rate Limit**
```json
{
  "errors": [{
    "code": 88,
    "message": "Rate limit exceeded"
  }]
}
```

**Reason:** Too many requests

**Solution:** System automatically handles with pacing

---

## Retry System

### Configuration

```typescript
pacing_retry_attempts = 0  // 1 total attempt (no retries)
pacing_retry_attempts = 1  // 2 total attempts (1 retry)
pacing_retry_attempts = 2  // 3 total attempts (2 retries)
```

### Logic Flow

```
Attempt 1: Send DM
  ↓
  Success? → Mark as 'sent' ✅
  ↓
  Permanent Error (403)? → Mark as 'skipped' ⏭️
  ↓
  Temporary Error? → Check retry count
    ↓
    retry_count < max? → Retry after delay ⏳
    ↓
    retry_count >= max? → Mark as 'failed' ❌
```

### Status Types

| Status | Meaning | Will Retry? |
|--------|---------|-------------|
| `pending` | Not attempted yet | N/A |
| `sent` | Successfully sent | No |
| `failed` | Failed after retries | No |
| `skipped` | Permanent error (403) | No |

---

## Pacing System

### Settings

```typescript
interface PacingSettings {
  perMinute: number;      // Max messages per minute (1-10)
  delayMin: number;       // Min delay between messages (seconds)
  delayMax: number;       // Max delay between messages (seconds)
  dailyCap: number;       // Max messages per day (1-500)
  retryAttempts: number;  // Retry attempts (0-5)
}
```

### Example Configuration

**Conservative (Safe):**
```typescript
{
  perMinute: 2,
  delayMin: 20,
  delayMax: 40,
  dailyCap: 50,
  retryAttempts: 1
}
```

**Moderate:**
```typescript
{
  perMinute: 3,
  delayMin: 15,
  delayMax: 30,
  dailyCap: 100,
  retryAttempts: 2
}
```

**Aggressive (Risky):**
```typescript
{
  perMinute: 5,
  delayMin: 10,
  delayMax: 20,
  dailyCap: 200,
  retryAttempts: 3
}
```

---

## Best Practices

### 1. **Follow Before DM**

✅ **Recommended Flow:**
```
Day 1: Run Follow Campaign
  ↓
Day 2-3: Wait for follows to process
  ↓
Day 4: Run DM Campaign to followers
```

This significantly reduces 403 errors.

### 2. **Start Conservative**

Begin with:
- 2 messages per minute
- 20-40 second delays
- 50 messages per day
- 0-1 retry attempts

Gradually increase if no issues.

### 3. **Monitor Results**

Watch for:
- High failure rate (>20%) → Reduce speed
- Many 403 errors → Follow users first
- Rate limit errors → Increase delays

### 4. **Message Quality**

- Personalize with `{{name}}` or `{{username}}`
- Keep messages short and natural
- Avoid spam-like content
- Don't include links in first message

---

## Technical Implementation

### Browser Headers

The system mimics a real browser:

```typescript
{
  'authorization': 'Bearer TOKEN',
  'cookie': 'auth_token=...; ct0=...',
  'x-csrf-token': 'ct0_value',
  'x-twitter-auth-type': 'OAuth2Session',
  'x-twitter-active-user': 'yes',
  'content-type': 'application/json',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  'referer': 'https://x.com/',
  'sec-ch-ua': '"Chromium";v="130"...',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin'
}
```

### Cookie Encryption

All Twitter cookies are encrypted with AES-256:

```typescript
// Encryption
const encrypted = encrypt(JSON.stringify(cookies));

// Decryption
const cookies = JSON.parse(decrypt(encrypted));
```

---

## Troubleshooting

### Problem: All DMs fail with 403

**Solution:**
1. Check if account can send DMs manually
2. Verify account is not restricted
3. Follow users before sending DMs

### Problem: DMs sent but not received

**Possible Causes:**
- User has DMs disabled
- Message filtered as spam
- Account shadow-banned

**Solution:**
- Test with your own account first
- Check message content quality
- Verify account health

### Problem: Rate limit errors

**Solution:**
- Increase `delayMin` and `delayMax`
- Reduce `perMinute`
- Lower `dailyCap`

---

## API Evolution

### History

1. **v1.0 (Initial):** Used `/dm/new.json` → Failed with 400
2. **v1.1:** Tried `/dm/new2.json` → Failed with 415
3. **v1.2:** Tried `/dm/conversation/create.json` → Failed with 400
4. **v1.3:** Tried GraphQL mutation → Failed with 404
5. **v2.0 (Current):** Using `/direct_messages/events/new.json` → ✅ Works!

### Why REST API v1.1?

- More stable than GraphQL
- Same method used by Follow system (proven to work)
- Official Twitter API format
- Better error messages

---

## Future Improvements

### Planned Features

1. **Message Templates:** Save and reuse message templates
2. **A/B Testing:** Test different messages
3. **Scheduling:** Send DMs at specific times
4. **Conversation Tracking:** Track replies
5. **Smart Targeting:** AI-powered recipient selection

### Under Consideration

- Image/GIF support in DMs
- Bulk import from CSV
- Integration with CRM systems
- Advanced analytics

---

## Conclusion

The DM system is now stable and production-ready. Key achievements:

✅ Working REST API integration
✅ Smart retry logic
✅ Permanent error detection
✅ User-friendly error messages
✅ Comprehensive pacing system

For questions or issues, check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or open an issue on GitHub.
