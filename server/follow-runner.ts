import { query } from './db-postgres';
import logger from './logger';
import { followUser } from './twitter';

interface FollowCampaignConfig {
  id: number;
  account_id: number;
  encrypted_cookies: string;
  settings_follows_per_minute: number;
  settings_daily_cap: number;
  settings_random_delay: boolean;
  settings_auto_pause: boolean;
}

interface FollowLog {
  timestamp: number;
  campaignId: number;
}

const runningFollowCampaigns = new Map<number, NodeJS.Timeout>();
const followLog = new Map<number, FollowLog[]>();
const processingFollowCampaigns = new Set<number>();

// بدء حملة متابعة
export function startFollowCampaign(campaignId: number) {
  if (runningFollowCampaigns.has(campaignId)) {
    console.log(`Follow campaign ${campaignId} is already running`);
    return;
  }

  db.prepare('UPDATE follow_campaigns SET status = ? WHERE id = ?').run('active', campaignId);

  if (!followLog.has(campaignId)) {
    followLog.set(campaignId, []);
  }

  const interval = setInterval(() => {
    processFollowCampaign(campaignId);
  }, 1000);

  runningFollowCampaigns.set(campaignId, interval);
  console.log(`✅ Follow campaign ${campaignId} started`);
}

// إيقاف حملة مؤقتاً
export function pauseFollowCampaign(campaignId: number) {
  const interval = runningFollowCampaigns.get(campaignId);
  if (interval) {
    clearInterval(interval);
    runningFollowCampaigns.delete(campaignId);
  }
  
  db.prepare('UPDATE follow_campaigns SET status = ? WHERE id = ?').run('paused', campaignId);
  console.log(`⏸️  Follow campaign ${campaignId} paused`);
}

// إيقاف حملة نهائياً
export function stopFollowCampaign(campaignId: number) {
  const interval = runningFollowCampaigns.get(campaignId);
  if (interval) {
    clearInterval(interval);
    runningFollowCampaigns.delete(campaignId);
  }
  
  followLog.delete(campaignId);
  
  db.prepare('UPDATE follow_campaigns SET status = ? WHERE id = ?').run('completed', campaignId);
  console.log(`⏹️  Follow campaign ${campaignId} stopped`);
}

// حساب عدد المتابعات في الدقيقة الأخيرة
function getFollowsInLastMinute(campaignId: number): number {
  const logs = followLog.get(campaignId) || [];
  const oneMinuteAgo = Date.now() - 60000;
  
  const recentLogs = logs.filter(log => log.timestamp > oneMinuteAgo);
  followLog.set(campaignId, recentLogs);
  
  return recentLogs.length;
}

// تسجيل متابعة
function logFollow(campaignId: number) {
  const logs = followLog.get(campaignId) || [];
  logs.push({ timestamp: Date.now(), campaignId });
  followLog.set(campaignId, logs);
}

// معالجة حملة متابعة
async function processFollowCampaign(campaignId: number) {
  if (processingFollowCampaigns.has(campaignId)) {
    return;
  }
  
  processingFollowCampaigns.add(campaignId);
  
  try {
    const campaign = db.prepare(`
      SELECT c.*, a.encrypted_cookies
      FROM follow_campaigns c
      JOIN accounts a ON c.account_id = a.id
      WHERE c.id = ? AND c.status = 'active'
    `).get(campaignId) as FollowCampaignConfig | undefined;

    if (!campaign) {
      pauseFollowCampaign(campaignId);
      return;
    }

    // التحقق من معدل المتابعة في الدقيقة
    const followsInLastMinute = getFollowsInLastMinute(campaignId);
    if (followsInLastMinute >= campaign.settings_follows_per_minute) {
      return;
    }

    // التحقق من الحد اليومي
    const today = new Date().toISOString().split('T')[0];
    const followsToday = db.prepare(`
      SELECT COUNT(*) as count
      FROM follow_targets
      WHERE campaign_id = ? 
        AND (status = 'followed' OR last_attempt_at IS NOT NULL)
        AND DATE(COALESCE(last_attempt_at, CURRENT_TIMESTAMP)) = ?
    `).get(campaignId, today) as { count: number };

    if (followsToday.count >= campaign.settings_daily_cap) {
      console.log(`⚠️  Follow campaign ${campaignId} reached daily cap (${campaign.settings_daily_cap})`);
      
      if (campaign.settings_auto_pause) {
        pauseFollowCampaign(campaignId);
      }
      return;
    }

    // الحصول على الهدف التالي
    const target = db.prepare(`
      SELECT * FROM follow_targets
      WHERE campaign_id = ? AND status = 'pending'
      ORDER BY id ASC
      LIMIT 1
    `).get(campaignId) as any;

    if (!target) {
      console.log(`✅ Follow campaign ${campaignId} completed - no more targets`);
      stopFollowCampaign(campaignId);
      return;
    }

    // التحقق من عدم متابعة نفس المستخدم مرتين
    const alreadyFollowed = db.prepare(`
      SELECT COUNT(*) as count
      FROM follow_targets
      WHERE campaign_id = ? AND username = ? AND status = 'followed'
    `).get(campaignId, target.username) as { count: number };

    if (alreadyFollowed.count > 0) {
      db.prepare(`
        UPDATE follow_targets
        SET status = 'skipped', error_message = 'Already followed'
        WHERE id = ?
      `).run(target.id);
      return;
    }

    console.log(`👤 [Follow Campaign ${campaignId}] Following ${target.username} (${followsInLastMinute + 1}/${campaign.settings_follows_per_minute} per min, ${followsToday.count + 1}/${campaign.settings_daily_cap} today)`);
    
    // تحديث last_attempt_at
    db.prepare(`
      UPDATE follow_targets
      SET last_attempt_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(target.id);
    
    // متابعة المستخدم
    const result = await followUser(campaign.encrypted_cookies, target.username);

    if (result.success) {
      logFollow(campaignId);
      
      db.prepare(`
        UPDATE follow_targets
        SET status = 'followed'
        WHERE id = ?
      `).run(target.id);

      db.prepare(`
        UPDATE follow_campaigns
        SET stats_sent = stats_sent + 1
        WHERE id = ?
      `).run(campaignId);

      console.log(`✅ [Follow Campaign ${campaignId}] Followed ${target.username}`);
      
      // تأخير عشوائي إذا كان مفعلاً
      if (campaign.settings_random_delay) {
        const delay = 5000 + Math.random() * 10000; // 5-15 ثانية
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } else {
      db.prepare(`
        UPDATE follow_targets
        SET status = 'failed', error_message = ?
        WHERE id = ?
      `).run(result.error || 'Unknown error', target.id);

      db.prepare(`
        UPDATE follow_campaigns
        SET stats_failed = stats_failed + 1
        WHERE id = ?
      `).run(campaignId);

      console.log(`❌ [Follow Campaign ${campaignId}] Failed to follow ${target.username}: ${result.error}`);
      
      // التحقق من معدل الفشل
      if (campaign.settings_auto_pause) {
        const stats = db.prepare(`
          SELECT stats_sent, stats_failed FROM follow_campaigns WHERE id = ?
        `).get(campaignId) as any;
        
        const totalAttempts = stats.stats_sent + stats.stats_failed;
        if (totalAttempts >= 10) {
          const failureRate = stats.stats_failed / totalAttempts;
          if (failureRate > 0.2) { // أكثر من 20% فشل
            console.log(`⚠️  High failure rate detected (${(failureRate * 100).toFixed(1)}%) - pausing campaign`);
            pauseFollowCampaign(campaignId);
          }
        }
      }
    }

  } catch (error) {
    console.error(`❌ Error processing follow campaign ${campaignId}:`, error);
  } finally {
    processingFollowCampaigns.delete(campaignId);
  }
}

// استئناف الحملات النشطة
export function resumeActiveFollowCampaigns() {
  const campaigns = db.prepare(`
    SELECT id FROM follow_campaigns WHERE status = 'active'
  `).all() as Array<{ id: number }>;

  for (const campaign of campaigns) {
    startFollowCampaign(campaign.id);
  }

  console.log(`Resumed ${campaigns.length} active follow campaigns`);
}
