# 🎯 Pacing & Retry System - Complete Guide

## Overview

The Pacing & Retry system is designed to protect your Twitter accounts from being banned while maximizing campaign effectiveness.

---

## System Components

### 1. **Pacing (Rate Limiting)**

Controls how fast messages/follows are sent to avoid Twitter's rate limits.

#### Settings:

| Setting | Description | Range | Default |
|---------|-------------|-------|---------|
| **Messages per Minute** | Max actions per 60 seconds | 1-10 | 3 |
| **Delay Min** | Minimum wait between actions (seconds) | 5-60 | 15 |
| **Delay Max** | Maximum wait between actions (seconds) | 10-120 | 30 |
| **Daily Cap** | Maximum actions per day | 1-500 | 50 |

#### How It Works:

```typescript
// Example: 3 messages per minute, 15-30s delay

Message 1 sent at 00:00
  ↓ Wait 23s (random between 15-30)
Message 2 sent at 00:23
  ↓ Wait 18s
Message 3 sent at 00:41
  ↓ Wait until 01:00 (per-minute limit reached)
Message 4 sent at 01:00
```

### 2. **Retry System**

Handles failed attempts intelligently.

#### Settings:

| Retry Attempts | Total Attempts | Behavior |
|----------------|----------------|----------|
| 0 | 1 | No retries, fail immediately |
| 1 | 2 | One retry after failure |
| 2 | 3 | Two retries after failure |
| 3 | 4 | Three retries after failure |

#### Logic Flow:

```
Attempt 1: Send message
  ↓
  ✅ Success? → Mark as 'sent', move to next
  ↓
  ❌ Permanent Error (403)? → Mark as 'skipped', move to next
  ↓
  ⚠️ Temporary Error?
    ↓
    Check: attemptNumber < maxAttempts?
      ↓
      Yes → Wait delay, retry
      ↓
      No → Mark as 'failed', move to next
```

---

## Error Types

### Permanent Errors (No Retry)

These errors will never succeed, so we skip immediately:

#### 1. **403 - Privacy Settings**
```json
{
  "code": 349,
  "message": "You cannot send messages to this user."
}
```

**Reason:** User doesn't accept DMs from non-followers

**Action:** Status set to `skipped`, no retry

**Solution:** Follow user first, wait 1-2 days, then DM

#### 2. **404 - User Not Found**
```json
{
  "code": 50,
  "message": "User not found."
}
```

**Reason:** Username doesn't exist or account deleted

**Action:** Status set to `skipped`, no retry

**Solution:** Verify username is correct

### Temporary Errors (Will Retry)

These might succeed on retry:

#### 1. **500 - Server Error**
```json
{
  "code": 131,
  "message": "Internal error."
}
```

**Reason:** Twitter server issue

**Action:** Retry after delay

#### 2. **Network Timeout**

**Reason:** Connection issue

**Action:** Retry after delay

---

## Status Types

| Status | Meaning | Next Action |
|--------|---------|-------------|
| `pending` | Not attempted yet | Will be processed |
| `sent` | Successfully sent | Done ✅ |
| `failed` | Failed after all retries | Done ❌ |
| `skipped` | Permanent error (403/404) | Done ⏭️ |

### Database Query

The system only processes targets with:
```sql
WHERE status = 'pending' 
   OR (status = 'failed' AND retry_count < maxAttempts)
```

This ensures:
- ✅ `sent` targets are never retried
- ✅ `skipped` targets are never retried
- ✅ `failed` targets are only retried if attempts remain

---

## Configuration Examples

### Conservative (Safest)

**Best for:**
- New accounts
- High-value accounts
- First campaigns

```typescript
{
  perMinute: 2,
  delayMin: 20,
  delayMax: 40,
  dailyCap: 50,
  retryAttempts: 0
}
```

**Expected Speed:** ~30 messages/hour, 50/day

### Moderate (Balanced)

**Best for:**
- Established accounts
- Regular use
- Most users

```typescript
{
  perMinute: 3,
  delayMin: 15,
  delayMax: 30,
  dailyCap: 100,
  retryAttempts: 1
}
```

**Expected Speed:** ~60 messages/hour, 100/day

### Aggressive (Risky)

**Best for:**
- Burner accounts
- High volume needs
- Experienced users

```typescript
{
  perMinute: 5,
  delayMin: 10,
  delayMax: 20,
  dailyCap: 200,
  retryAttempts: 2
}
```

**Expected Speed:** ~120 messages/hour, 200/day

⚠️ **Warning:** Higher risk of account restrictions

---

## Best Practices

### 1. Start Slow

Begin with conservative settings:
- 2 messages per minute
- 20-40 second delays
- 50 daily cap
- 0 retry attempts

Monitor for 2-3 days, then gradually increase.

### 2. Monitor Failure Rate

| Failure Rate | Action |
|--------------|--------|
| < 10% | Good, can increase speed |
| 10-20% | Acceptable, maintain settings |
| 20-30% | High, reduce speed |
| > 30% | Critical, stop and review |

### 3. Respect Daily Caps

Don't exceed:
- **New accounts:** 50 messages/day
- **Established accounts:** 100 messages/day
- **Verified accounts:** 200 messages/day

### 4. Use Random Delays

Always use a range (min/max) rather than fixed delays:
- ✅ Good: 15-30 seconds (random)
- ❌ Bad: 20 seconds (fixed)

Random delays appear more human-like.

### 5. Follow Before DM

To reduce 403 errors:
1. Run Follow Campaign first
2. Wait 24-48 hours
3. Then run DM Campaign

This significantly improves success rate.

---

## Technical Implementation

### Message Log Tracking

```typescript
interface MessageLog {
  timestamp: number;
  campaignId: number;
}

// Track last 60 seconds
const messageLog = new Map<number, MessageLog[]>();

function getMessagesInLastMinute(campaignId: number): number {
  const logs = messageLog.get(campaignId) || [];
  const oneMinuteAgo = Date.now() - 60000;
  return logs.filter(log => log.timestamp > oneMinuteAgo).length;
}
```

### Retry Count Tracking

```typescript
// In database
interface Target {
  id: number;
  retry_count: number;  // Incremented on each attempt
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  last_attempt_at: Date;
  error_message: string;
}

// Logic
const currentRetryCount = target.retry_count || 0;
const attemptNumber = currentRetryCount + 1;
const maxAttempts = campaign.pacing_retry_attempts + 1;

if (attemptNumber >= maxAttempts) {
  // No more retries
  status = 'failed';
} else {
  // Will retry
  status = 'failed'; // Temporary, will be picked up again
}
```

### Delay Calculation

```typescript
function calculateDelay(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Example: min=15, max=30
// Result: Random between 15.0 and 30.0 seconds
```

---

## Monitoring & Analytics

### Campaign Stats

Track these metrics:

```typescript
interface CampaignStats {
  stats_total: number;      // Total targets
  stats_sent: number;       // Successfully sent
  stats_failed: number;     // Failed after retries
  stats_skipped: number;    // Skipped (403/404)
}

// Success Rate
const successRate = (stats_sent / stats_total) * 100;

// Failure Rate
const failureRate = (stats_failed / stats_total) * 100;

// Skip Rate (Privacy)
const skipRate = (stats_skipped / stats_total) * 100;
```

### Health Indicators

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Success Rate | > 70% | 50-70% | < 50% |
| Failure Rate | < 10% | 10-20% | > 20% |
| Skip Rate | < 20% | 20-40% | > 40% |

---

## Troubleshooting

### Problem: Too Many 403 Errors

**Symptoms:** High skip rate (>30%)

**Solutions:**
1. Follow users before sending DMs
2. Target users who follow you
3. Improve message quality
4. Check account reputation

### Problem: Rate Limit Errors

**Symptoms:** 429 errors, campaign pauses

**Solutions:**
1. Increase `delayMin` and `delayMax`
2. Reduce `perMinute`
3. Lower `dailyCap`
4. Add more delay between campaigns

### Problem: High Failure Rate

**Symptoms:** Many failed targets

**Solutions:**
1. Check account health
2. Verify cookies are valid
3. Test with manual DM first
4. Review error messages

---

## Migration Notes

### v2.0.0 Changes

**Default Retry Attempts:** 2 → 0

**Reason:** Most users prefer no automatic retries

**Migration:** Automatic via database migration

**Impact:** Existing campaigns updated to 0 retries

**Action:** Review campaign settings if you want retries

---

## Future Enhancements

### Planned Features

1. **Adaptive Pacing:** Auto-adjust based on success rate
2. **Smart Scheduling:** Send during optimal times
3. **Account Health Monitoring:** Track account status
4. **Predictive Analytics:** Estimate success probability

---

## Conclusion

The Pacing & Retry system is designed to:
- ✅ Protect your accounts from bans
- ✅ Maximize campaign success
- ✅ Handle errors intelligently
- ✅ Provide full control

Start conservative, monitor results, and adjust gradually.

For more details, see:
- [DM_SYSTEM.md](DM_SYSTEM.md) - DM-specific details
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [API_DOCS.md](API_DOCS.md) - API reference
