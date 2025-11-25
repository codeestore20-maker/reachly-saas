import { query } from './db-postgres';
import { sendDM } from './twitter';
import { incrementUsage } from './subscription';
import logger from './logger';

interface CampaignConfig {
  id: number;
  account_id: number;
  encrypted_cookies: string;
  message_template: string;
  pacing_per_minute: number;
  pacing_delay_min: number;
  pacing_delay_max: number;
  pacing_daily_cap: number;
  pacing_retry_attempts: number;
  rate_limit_count?: number;
  last_rate_limit_at?: Date;
  successful_actions_since_rate_limit?: number;
}

interface MessageLog {
  timestamp: number;
  campaignId: number;
}

const runningCampaigns = new Map<number, NodeJS.Timeout>();
const messageLog = new Map<number, MessageLog[]>();
const processingCampaigns = new Set<number>();

/**
 * Calculate intelligent backoff time based on consecutive rate limits
 * Uses exponential backoff: 1min → 3min → 9min → 15min (max)
 */
function calculateBackoffMinutes(consecutiveRateLimits: number): number {
  const backoffLevels = [1, 3, 9, 15]; // minutes
  const index = Math.min(consecutiveRateLimits - 1, backoffLevels.length - 1);
  return backoffLevels[Math.max(0, index)];
}

// بدء حملة
export async function startCampaign(campaignId: number) {
  if (runningCampaigns.has(campaignId)) {
    console.log(`Campaign ${campaignId} is already running`);
    return;
  }

  await query('UPDATE campaigns SET status = $1 WHERE id = $2', ['active', campaignId]);

  if (!messageLog.has(campaignId)) {
    messageLog.set(campaignId, []);
  }

  const interval = setInterval(() => {
    processCampaign(campaignId);
  }, 1000);

  runningCampaigns.set(campaignId, interval);
  console.log(`▶️  Campaign ${campaignId} started`);
}

// إيقاف مؤقت للحملة
export async function pauseCampaign(campaignId: number) {
  const interval = runningCampaigns.get(campaignId);
  if (interval) {
    clearInterval(interval);
    runningCampaigns.delete(campaignId);
  }
  
  await query('UPDATE campaigns SET status = $1 WHERE id = $2', ['paused', campaignId]);
  console.log(`⏸️  Campaign ${campaignId} paused`);
}

// إيقاف نهائي للحملة
export async function stopCampaign(campaignId: number) {
  const interval = runningCampaigns.get(campaignId);
  if (interval) {
    clearInterval(interval);
    runningCampaigns.delete(campaignId);
  }
  
  processingCampaigns.delete(campaignId);
  messageLog.delete(campaignId);
  
  await query('UPDATE campaigns SET status = $1 WHERE id = $2', ['completed', campaignId]);
  console.log(`⏹️  Campaign ${campaignId} stopped`);
}

function logMessage(campaignId: number) {
  const logs = messageLog.get(campaignId) || [];
  logs.push({ timestamp: Date.now(), campaignId });
  messageLog.set(campaignId, logs);
  
  const oneMinuteAgo = Date.now() - 60000;
  const recentLogs = logs.filter(log => log.timestamp > oneMinuteAgo);
  messageLog.set(campaignId, recentLogs);
}

function getMessagesInLastMinute(campaignId: number): number {
  const logs = messageLog.get(campaignId) || [];
  const oneMinuteAgo = Date.now() - 60000;
  return logs.filter(log => log.timestamp > oneMinuteAgo).length;
}

async function processCampaign(campaignId: number) {
  if (processingCampaigns.has(campaignId)) {
    return;
  }
  
  processingCampaigns.add(campaignId);
  
  try {
    const campaignResult = await query(`
      SELECT c.*, a.encrypted_cookies
      FROM campaigns c
      JOIN accounts a ON c.account_id = a.id
      WHERE c.id = $1 AND c.status = 'active'
    `, [campaignId]);

    if (!campaignResult.rows[0]) {
      stopCampaign(campaignId);
      return;
    }

    const campaign = campaignResult.rows[0] as CampaignConfig;
    const messagesInLastMinute = getMessagesInLastMinute(campaignId);

    if (messagesInLastMinute >= campaign.pacing_per_minute) {
      processingCampaigns.delete(campaignId);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const attemptsTodayResult = await query(`
      SELECT COUNT(*) as count
      FROM targets
      WHERE campaign_id = $1 
        AND DATE(last_attempt_at) = $2
    `, [campaignId, today]);

    const attemptsToday = attemptsTodayResult.rows[0];

    if (attemptsToday.count >= campaign.pacing_daily_cap) {
      console.log(`⏸️  Campaign ${campaignId} reached daily cap (${campaign.pacing_daily_cap})`);
      processingCampaigns.delete(campaignId);
      return;
    }

    // Get next target that hasn't been sent and hasn't exceeded retry limit
    // pacing_retry_attempts = 0 means 1 total attempt (no retries)
    // pacing_retry_attempts = 1 means 2 total attempts (1 retry)
    // pacing_retry_attempts = 2 means 3 total attempts (2 retries)
    const maxAttempts = campaign.pacing_retry_attempts + 1;
    
    const targetResult = await query(`
      SELECT * FROM targets
      WHERE campaign_id = $1 
        AND status != 'sent'
        AND (status = 'pending' OR (status = 'failed' AND retry_count < $2))
      ORDER BY created_at ASC
      LIMIT 1
    `, [campaignId, maxAttempts]);

    const target = targetResult.rows[0];

    if (!target) {
      console.log(`✅ Campaign ${campaignId} completed - no more targets`);
      stopCampaign(campaignId);
      return;
    }

    const alreadySentResult = await query(`
      SELECT COUNT(*) as count
      FROM targets
      WHERE campaign_id = $1 AND username = $2 AND status = 'sent'
    `, [campaignId, target.username]);

    if (alreadySentResult.rows[0].count > 0) {
      await query(`
        UPDATE targets
        SET status = 'skipped', error_message = 'Already sent to this user'
        WHERE id = $1
      `, [target.id]);
      processingCampaigns.delete(campaignId);
      return;
    }

    const currentRetryCount = target.retry_count || 0;
    const isRetry = currentRetryCount > 0;
    const attemptNumber = currentRetryCount + 1;

    const message = campaign.message_template
      .replace(/\{\{name\}\}/g, target.name || target.username)
      .replace(/\{\{username\}\}/g, target.username);

    console.log(`📤 [Campaign ${campaignId}] ${isRetry ? `Retry #${attemptNumber}` : 'Sending'} to ${target.username}`);
    
    await query(`
      UPDATE targets
      SET retry_count = retry_count + 1, last_attempt_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [target.id]);

    const result = await sendDM(campaign.encrypted_cookies, target.username, message);

    // Calculate delay for this attempt (always use configured delay - respects campaign settings)
    const delay = campaign.pacing_delay_min + Math.random() * (campaign.pacing_delay_max - campaign.pacing_delay_min);

    // Handle rate limit with intelligent exponential backoff
    if (result.isRateLimit) {
      const rateLimitCount = (campaign.rate_limit_count || 0) + 1;
      const backoffMinutes = calculateBackoffMinutes(rateLimitCount);
      
      console.log(`⏸️  [Campaign ${campaignId}] Rate limit #${rateLimitCount} detected - pausing for ${backoffMinutes} minute(s)`);
      
      // Update rate limit tracking (don't count as retry attempt)
      await query(`
        UPDATE campaigns 
        SET rate_limit_count = $1, 
            last_rate_limit_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [rateLimitCount, campaignId]);
      
      // Reset target retry count (rate limit is not target's fault)
      await query(`
        UPDATE targets
        SET retry_count = GREATEST(retry_count - 1, 0),
            error_message = $1
        WHERE id = $2
      `, ['Rate limit - will retry after backoff', target.id]);
      
      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoffMinutes * 60 * 1000));
      
      console.log(`▶️  [Campaign ${campaignId}] Resuming after rate limit backoff`);
      
    } else if (result.success) {
      logMessage(campaignId);
      
      await query(`
        UPDATE targets
        SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [target.id]);

      await query(`
        UPDATE campaigns
        SET stats_sent = stats_sent + 1
        WHERE id = $1
      `, [campaignId]);

      // Increment user's DM usage
      const campaignUserResult = await query(`SELECT user_id FROM campaigns WHERE id = $1`, [campaignId]);
      if (campaignUserResult.rows[0]) {
        await incrementUsage(campaignUserResult.rows[0].user_id, 'dms');
      }

      // Track successful actions for rate limit reset
      const successCount = (campaign.successful_actions_since_rate_limit || 0) + 1;
      
      // Reset rate limit counter after 10 consecutive successes
      if (successCount >= 10 && campaign.rate_limit_count > 0) {
        await query(`
          UPDATE campaigns 
          SET rate_limit_count = 0,
              successful_actions_since_rate_limit = 0
          WHERE id = $1
        `, [campaignId]);
        console.log(`🔄 [Campaign ${campaignId}] Rate limit counter reset - system stable`);
      } else {
        await query(`
          UPDATE campaigns 
          SET successful_actions_since_rate_limit = $1
          WHERE id = $2
        `, [successCount, campaignId]);
      }

      console.log(`✅ [Campaign ${campaignId}] Sent to ${target.username}`);
      console.log(`⏳ [Campaign ${campaignId}] Waiting ${delay.toFixed(1)}s before next message`);
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      
    } else {
      // Check for permanent errors that shouldn't be retried
      const isPermanentError = result.error?.includes('403') || 
                               result.error?.includes('cannot send messages') ||
                               result.error?.includes('code":349');
      
      // Check if we should retry
      // pacing_retry_attempts = 0 means 1 total attempt (no retries)
      // pacing_retry_attempts = 1 means 2 total attempts (1 retry)
      const maxAttempts = campaign.pacing_retry_attempts + 1;
      
      if (attemptNumber >= maxAttempts || isPermanentError) {
        // No more retries allowed - mark as permanently failed
        const friendlyError = isPermanentError 
          ? 'User privacy settings prevent receiving messages from non-followers'
          : result.error || 'Unknown error';
        
        // Use 'skipped' status for permanent errors to prevent retries
        const finalStatus = isPermanentError ? 'skipped' : 'failed';
          
        await query(`
          UPDATE targets
          SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [finalStatus, friendlyError, target.id]);

        await query(`
          UPDATE campaigns
          SET stats_failed = stats_failed + 1
          WHERE id = $1
        `, [campaignId]);

        const reason = isPermanentError ? 'user privacy settings' : `${attemptNumber}/${maxAttempts} attempts`;
        console.log(`❌ [Campaign ${campaignId}] Failed permanently to ${target.username} (${reason})`);
        // Use configured delay even after failure to maintain pacing
        console.log(`⏳ [Campaign ${campaignId}] Waiting ${delay.toFixed(1)}s before next target`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      } else {
        // Still have retries left - keep status as 'failed' so it will be retried
        await query(`
          UPDATE targets
          SET status = 'failed', error_message = $1
          WHERE id = $2
        `, [result.error || 'Unknown error', target.id]);

        console.log(`⚠️  [Campaign ${campaignId}] Failed to ${target.username}, will retry (${attemptNumber}/${maxAttempts})`);
        // Use configured delay before retry to maintain consistent pacing
        console.log(`⏳ [Campaign ${campaignId}] Waiting ${delay.toFixed(1)}s before retry`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      }
    }

  } catch (error) {
    console.error(`Error processing campaign ${campaignId}:`, error);
  } finally {
    processingCampaigns.delete(campaignId);
  }
}

export async function resumeActiveCampaigns() {
  try {
    const campaignsResult = await query(`
      SELECT id FROM campaigns WHERE status = 'active'
    `);

    for (const campaign of campaignsResult.rows) {
      console.log(`Resume campaign ${campaign.id} - temporarily disabled`);
      // await startCampaign(campaign.id);
    }
  } catch (error) {
    console.error('Error resuming campaigns:', error);
  }
}
