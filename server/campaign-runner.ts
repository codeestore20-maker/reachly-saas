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
}

interface MessageLog {
  timestamp: number;
  campaignId: number;
}

const runningCampaigns = new Map<number, NodeJS.Timeout>();
const messageLog = new Map<number, MessageLog[]>();
const processingCampaigns = new Set<number>();

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

    const targetResult = await query(`
      SELECT * FROM targets
      WHERE campaign_id = $1 
        AND status != 'sent'
        AND (status = 'pending' OR (status = 'failed' AND retry_count < $2))
      ORDER BY created_at ASC
      LIMIT 1
    `, [campaignId, campaign.pacing_retry_attempts]);

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

    if (result.success) {
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

      console.log(`✅ [Campaign ${campaignId}] Sent to ${target.username}`);
    } else {
      if (currentRetryCount >= campaign.pacing_retry_attempts) {
        await query(`
          UPDATE targets
          SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [result.error || 'Unknown error', target.id]);

        await query(`
          UPDATE campaigns
          SET stats_failed = stats_failed + 1
          WHERE id = $1
        `, [campaignId]);

        console.log(`❌ [Campaign ${campaignId}] Failed permanently to ${target.username}`);
      } else {
        await query(`
          UPDATE targets
          SET error_message = $1
          WHERE id = $2
        `, [result.error || 'Unknown error', target.id]);

        console.log(`⚠️  [Campaign ${campaignId}] Failed to ${target.username}, will retry`);
      }
    }

    const delay = campaign.pacing_delay_min + Math.random() * (campaign.pacing_delay_max - campaign.pacing_delay_min);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));

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
