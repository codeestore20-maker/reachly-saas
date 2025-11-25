import { query } from './db-postgres';
import { followUser } from './twitter';
import { incrementUsage } from './subscription';
import logger from './logger';

interface FollowCampaignConfig {
  id: number;
  account_id: number;
  encrypted_cookies: string;
  pacing_per_minute: number;
  pacing_daily_cap: number;
  pacing_delay_min: number;
  pacing_delay_max: number;
  pacing_retry_attempts: number;
  rate_limit_count?: number;
  last_rate_limit_at?: Date;
  successful_actions_since_rate_limit?: number;
}

interface FollowLog {
  timestamp: number;
  campaignId: number;
}

const runningFollowCampaigns = new Map<number, NodeJS.Timeout>();
const followLog = new Map<number, FollowLog[]>();
const processingFollowCampaigns = new Set<number>();

/**
 * Calculate intelligent backoff time based on consecutive rate limits
 * Uses exponential backoff: 1min → 3min → 9min → 15min (max)
 */
function calculateBackoffMinutes(consecutiveRateLimits: number): number {
  const backoffLevels = [1, 3, 9, 15]; // minutes
  const index = Math.min(consecutiveRateLimits - 1, backoffLevels.length - 1);
  return backoffLevels[Math.max(0, index)];
}

export async function startFollowCampaign(campaignId: number) {
  if (runningFollowCampaigns.has(campaignId)) {
    console.log(`Follow campaign ${campaignId} is already running`);
    return;
  }

  await query('UPDATE follow_campaigns SET status = $1 WHERE id = $2', ['active', campaignId]);

  if (!followLog.has(campaignId)) {
    followLog.set(campaignId, []);
  }

  const interval = setInterval(() => {
    processFollowCampaign(campaignId);
  }, 1000);

  runningFollowCampaigns.set(campaignId, interval);
  console.log(`✅ Follow campaign ${campaignId} started`);
}

export async function pauseFollowCampaign(campaignId: number) {
  const interval = runningFollowCampaigns.get(campaignId);
  if (interval) {
    clearInterval(interval);
    runningFollowCampaigns.delete(campaignId);
  }
  
  await query('UPDATE follow_campaigns SET status = $1 WHERE id = $2', ['paused', campaignId]);
  console.log(`⏸️  Follow campaign ${campaignId} paused`);
}

export async function stopFollowCampaign(campaignId: number) {
  const interval = runningFollowCampaigns.get(campaignId);
  if (interval) {
    clearInterval(interval);
    runningFollowCampaigns.delete(campaignId);
  }
  
  processingFollowCampaigns.delete(campaignId);
  followLog.delete(campaignId);
  
  await query('UPDATE follow_campaigns SET status = $1 WHERE id = $2', ['completed', campaignId]);
  console.log(`⏹️  Follow campaign ${campaignId} stopped`);
}

function logFollow(campaignId: number) {
  const logs = followLog.get(campaignId) || [];
  logs.push({ timestamp: Date.now(), campaignId });
  followLog.set(campaignId, logs);
  
  const oneMinuteAgo = Date.now() - 60000;
  const recentLogs = logs.filter(log => log.timestamp > oneMinuteAgo);
  followLog.set(campaignId, recentLogs);
}

function getFollowsInLastMinute(campaignId: number): number {
  const logs = followLog.get(campaignId) || [];
  const oneMinuteAgo = Date.now() - 60000;
  return logs.filter(log => log.timestamp > oneMinuteAgo).length;
}

async function processFollowCampaign(campaignId: number) {
  if (processingFollowCampaigns.has(campaignId)) {
    return;
  }
  
  processingFollowCampaigns.add(campaignId);
  
  try {
    const campaignResult = await query(`
      SELECT c.*, a.encrypted_cookies
      FROM follow_campaigns c
      JOIN accounts a ON c.account_id = a.id
      WHERE c.id = $1 AND c.status = 'active'
    `, [campaignId]);

    if (!campaignResult.rows[0]) {
      stopFollowCampaign(campaignId);
      return;
    }

    const campaign = campaignResult.rows[0] as FollowCampaignConfig;
    const followsInLastMinute = getFollowsInLastMinute(campaignId);

    if (followsInLastMinute >= campaign.pacing_per_minute) {
      processingFollowCampaigns.delete(campaignId);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const successfulFollowsResult = await query(`
      SELECT COUNT(*) as count
      FROM follow_targets
      WHERE campaign_id = $1 
        AND status = 'followed'
        AND followed_at >= CURRENT_DATE
    `, [campaignId]);

    const successfulFollows = successfulFollowsResult.rows[0];

    console.log(`[Campaign ${campaignId}] Daily cap check: ${successfulFollows.count}/${campaign.pacing_daily_cap} successful follows today`);

    if (successfulFollows.count >= campaign.pacing_daily_cap) {
      console.log(`⏸️  Follow campaign ${campaignId} reached daily cap - pausing until tomorrow`);
      await pauseFollowCampaign(campaignId);
      processingFollowCampaigns.delete(campaignId);
      return;
    }

    const targetResult = await query(`
      SELECT * FROM follow_targets
      WHERE campaign_id = $1 
        AND status != 'followed'
        AND (status = 'pending' OR (status = 'failed' AND retry_count < $2))
      ORDER BY created_at ASC
      LIMIT 1
    `, [campaignId, campaign.pacing_retry_attempts]);

    const target = targetResult.rows[0];

    if (!target) {
      console.log(`✅ Follow campaign ${campaignId} completed - all targets processed`);
      stopFollowCampaign(campaignId);
      processingFollowCampaigns.delete(campaignId);
      return;
    }

    await query(`
      UPDATE follow_targets
      SET retry_count = retry_count + 1, last_attempt_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [target.id]);

    const result = await followUser(campaign.encrypted_cookies, target.username, target.user_id);

    // Handle rate limit with intelligent exponential backoff
    if (result.isRateLimit) {
      const rateLimitCount = (campaign.rate_limit_count || 0) + 1;
      const backoffMinutes = calculateBackoffMinutes(rateLimitCount);
      
      console.log(`⏸️  [Follow Campaign ${campaignId}] Rate limit #${rateLimitCount} detected - pausing for ${backoffMinutes} minute(s)`);
      
      // Update rate limit tracking (don't count as retry attempt)
      await query(`
        UPDATE follow_campaigns 
        SET rate_limit_count = $1, 
            last_rate_limit_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [rateLimitCount, campaignId]);
      
      // Reset target retry count (rate limit is not target's fault)
      await query(`
        UPDATE follow_targets
        SET retry_count = GREATEST(retry_count - 1, 0),
            error_message = $1
        WHERE id = $2
      `, ['Rate limit - will retry after backoff', target.id]);
      
      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoffMinutes * 60 * 1000));
      
      console.log(`▶️  [Follow Campaign ${campaignId}] Resuming after rate limit backoff`);
      
    } else if (result.success) {
      logFollow(campaignId);
      
      await query(`
        UPDATE follow_targets
        SET status = 'followed', followed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [target.id]);

      await query(`
        UPDATE follow_campaigns
        SET stats_followed = stats_followed + 1
        WHERE id = $1
      `, [campaignId]);

      // Increment user's follow usage
      const campaignUserResult = await query(`SELECT user_id FROM follow_campaigns WHERE id = $1`, [campaignId]);
      if (campaignUserResult.rows[0]) {
        await incrementUsage(campaignUserResult.rows[0].user_id, 'follows');
      }

      // Track successful actions for rate limit reset
      const successCount = (campaign.successful_actions_since_rate_limit || 0) + 1;
      
      // Reset rate limit counter after 10 consecutive successes
      if (successCount >= 10 && campaign.rate_limit_count > 0) {
        await query(`
          UPDATE follow_campaigns 
          SET rate_limit_count = 0,
              successful_actions_since_rate_limit = 0
          WHERE id = $1
        `, [campaignId]);
        console.log(`🔄 [Follow Campaign ${campaignId}] Rate limit counter reset - system stable`);
      } else {
        await query(`
          UPDATE follow_campaigns 
          SET successful_actions_since_rate_limit = $1
          WHERE id = $2
        `, [successCount, campaignId]);
      }

      console.log(`✅ [Follow Campaign ${campaignId}] Followed ${target.username}`);
      
    } else {
      // Handle other errors (not rate limit)
      const currentRetryCount = target.retry_count || 0;
      
      if (currentRetryCount >= campaign.pacing_retry_attempts) {
        await query(`
          UPDATE follow_targets
          SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [result.error || 'Unknown error', target.id]);

        await query(`
          UPDATE follow_campaigns
          SET stats_failed = stats_failed + 1
          WHERE id = $1
        `, [campaignId]);

        console.log(`❌ [Follow Campaign ${campaignId}] Failed to follow ${target.username}: ${result.error}`);
      } else {
        await query(`
          UPDATE follow_targets
          SET error_message = $1
          WHERE id = $2
        `, [result.error || 'Unknown error', target.id]);

        console.log(`⚠️  [Follow Campaign ${campaignId}] Failed to follow ${target.username}, will retry (${currentRetryCount}/${campaign.pacing_retry_attempts})`);
      }
    }

    // Always respect campaign settings for delay (unchanged)
    const delay = campaign.pacing_delay_min + Math.random() * (campaign.pacing_delay_max - campaign.pacing_delay_min);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));

  } catch (error) {
    console.error(`Error processing follow campaign ${campaignId}:`, error);
  } finally {
    processingFollowCampaigns.delete(campaignId);
  }
}

export async function resumeActiveFollowCampaigns() {
  try {
    const campaignsResult = await query(`
      SELECT id FROM follow_campaigns WHERE status = 'active'
    `);

    for (const campaign of campaignsResult.rows) {
      console.log(`Resume follow campaign ${campaign.id} - temporarily disabled`);
      // await startFollowCampaign(campaign.id);
    }
  } catch (error) {
    console.error('Error resuming follow campaigns:', error);
  }
}
