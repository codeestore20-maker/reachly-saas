import { query } from './db-postgres';
import { sendDM } from './twitter';
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
const messageLog = new Map<number, MessageLog[]>(); // تتبع الرسائل المرسلة لكل حملة
const processingCampaigns = new Set<number>(); // تتبع الحملات التي يتم معالجتها حالياً

// بدء حملة
export function startCampaign(campaignId: number) {
  if (runningCampaigns.has(campaignId)) {
    console.log(`Campaign ${campaignId} is already running`);
    return;
  }

  // تحديث الحالة
  db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('active', campaignId);

  // تهيئة سجل الرسائل
  if (!messageLog.has(campaignId)) {
    messageLog.set(campaignId, []);
  }

  // بدء المعالجة - كل ثانية للتحقق من الشروط
  const interval = setInterval(() => {
    processCampaign(campaignId);
  }, 1000); // كل ثانية

  runningCampaigns.set(campaignId, interval);
  console.log(`✅ Campaign ${campaignId} started`);
}

// إيقاف حملة مؤقتاً
export function pauseCampaign(campaignId: number) {
  const interval = runningCampaigns.get(campaignId);
  if (interval) {
    clearInterval(interval);
    runningCampaigns.delete(campaignId);
  }
  
  db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('paused', campaignId);
  console.log(`⏸️  Campaign ${campaignId} paused`);
}

// إيقاف حملة نهائياً
export function stopCampaign(campaignId: number) {
  const interval = runningCampaigns.get(campaignId);
  if (interval) {
    clearInterval(interval);
    runningCampaigns.delete(campaignId);
  }
  
  // تنظيف سجل الرسائل
  messageLog.delete(campaignId);
  
  db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('completed', campaignId);
  console.log(`⏹️  Campaign ${campaignId} stopped`);
}

// حساب عدد الرسائل المرسلة في الدقيقة الأخيرة
function getMessagesInLastMinute(campaignId: number): number {
  const logs = messageLog.get(campaignId) || [];
  const oneMinuteAgo = Date.now() - 60000; // 60 ثانية
  
  // تنظيف السجلات القديمة
  const recentLogs = logs.filter(log => log.timestamp > oneMinuteAgo);
  messageLog.set(campaignId, recentLogs);
  
  return recentLogs.length;
}

// تسجيل رسالة مرسلة
function logMessage(campaignId: number) {
  const logs = messageLog.get(campaignId) || [];
  logs.push({ timestamp: Date.now(), campaignId });
  messageLog.set(campaignId, logs);
}

// معالجة حملة
async function processCampaign(campaignId: number) {
  // ✅ منع المعالجة المتزامنة - إذا كانت الحملة قيد المعالجة، انتظر
  if (processingCampaigns.has(campaignId)) {
    return;
  }
  
  processingCampaigns.add(campaignId);
  
  try {
    // الحصول على معلومات الحملة
    const campaign = db.prepare(`
      SELECT c.*, a.encrypted_cookies
      FROM campaigns c
      JOIN accounts a ON c.account_id = a.id
      WHERE c.id = ? AND c.status = 'active'
    `).get(campaignId) as CampaignConfig | undefined;

    if (!campaign) {
      pauseCampaign(campaignId);
      return;
    }

    // ✅ التحقق من معدل الإرسال في الدقيقة
    const messagesInLastMinute = getMessagesInLastMinute(campaignId);
    if (messagesInLastMinute >= campaign.pacing_per_minute) {
      // وصلنا للحد الأقصى في الدقيقة - انتظر
      return;
    }

    // ✅ التحقق من الحد اليومي (محاولات الإرسال الفعلية)
    const today = new Date().toISOString().split('T')[0];
    const attemptsToday = db.prepare(`
      SELECT COUNT(*) as count
      FROM targets
      WHERE campaign_id = ? 
        AND (status = 'sent' OR retry_count > 0)
        AND DATE(COALESCE(sent_at, last_attempt_at)) = ?
    `).get(campaignId, today) as { count: number };

    if (attemptsToday.count >= campaign.pacing_daily_cap) {
      console.log(`⚠️  Campaign ${campaignId} reached daily cap (${campaign.pacing_daily_cap} attempts)`);
      pauseCampaign(campaignId);
      return;
    }

    // ✅ الحصول على الهدف التالي (pending أو failed مع محاولات متبقية)
    const target = db.prepare(`
      SELECT * FROM targets
      WHERE campaign_id = ? 
        AND status != 'sent'
        AND retry_count < ?
      ORDER BY 
        CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
        id ASC
      LIMIT 1
    `).get(campaignId, campaign.pacing_retry_attempts) as any;

    if (!target) {
      // لا توجد أهداف متبقية
      console.log(`✅ Campaign ${campaignId} completed - no more targets`);
      stopCampaign(campaignId);
      return;
    }

    // ✅ التحقق من عدم إرسال رسالة مكررة لنفس المستخدم
    const alreadySent = db.prepare(`
      SELECT COUNT(*) as count
      FROM targets
      WHERE campaign_id = ? AND username = ? AND status = 'sent'
    `).get(campaignId, target.username) as { count: number };

    if (alreadySent.count > 0) {
      // تم الإرسال بالفعل - تخطي
      db.prepare(`
        UPDATE targets
        SET status = 'skipped', error_message = 'Already sent to this user'
        WHERE id = ?
      `).run(target.id);
      return;
    }

    // تخصيص الرسالة
    const message = campaign.message_template
      .replace(/\{\{name\}\}/g, target.name || target.username)
      .replace(/\{\{username\}\}/g, target.handle);

    // ✅ حساب التأخير العشوائي
    const delay = Math.random() * (campaign.pacing_delay_max - campaign.pacing_delay_min) + campaign.pacing_delay_min;
    
    const attemptNumber = target.retry_count + 1;
    const isRetry = target.retry_count > 0;
    
    console.log(`📤 [Campaign ${campaignId}] ${isRetry ? `Retry #${attemptNumber}` : 'Sending'} to ${target.username} (${messagesInLastMinute + 1}/${campaign.pacing_per_minute} per min, ${attemptsToday.count + 1}/${campaign.pacing_daily_cap} today)`);
    
    // ✅ تحديث retry_count و last_attempt_at قبل الإرسال
    db.prepare(`
      UPDATE targets
      SET retry_count = retry_count + 1, last_attempt_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(target.id);
    
    // إرسال الرسالة
    const result = await sendDM(campaign.encrypted_cookies, target.username, message);

    if (result.success) {
      // ✅ نجح الإرسال
      logMessage(campaignId);
      
      // تحديث الهدف إلى sent
      db.prepare(`
        UPDATE targets
        SET status = 'sent', sent_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(target.id);

      // تحديث إحصائيات الحملة
      db.prepare(`
        UPDATE campaigns
        SET stats_sent = stats_sent + 1
        WHERE id = ?
      `).run(campaignId);

      console.log(`✅ [Campaign ${campaignId}] ${isRetry ? 'Retry succeeded' : 'Sent'} to ${target.username} - waiting ${delay.toFixed(1)}s`);
      
      // ✅ تأخير عشوائي بعد الإرسال
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      
    } else {
      // ✅ فشل الإرسال
      const currentRetryCount = target.retry_count + 1;
      
      if (currentRetryCount >= campaign.pacing_retry_attempts) {
        // استنفدنا المحاولات - تحديث إلى failed نهائياً
        db.prepare(`
          UPDATE targets
          SET status = 'failed', error_message = ?
          WHERE id = ?
        `).run(result.error || 'Unknown error', target.id);

        // تحديث إحصائيات الحملة
        db.prepare(`
          UPDATE campaigns
          SET stats_failed = stats_failed + 1
          WHERE id = ?
        `).run(campaignId);

        console.log(`❌ [Campaign ${campaignId}] Failed permanently to ${target.username} after ${currentRetryCount} attempts: ${result.error}`);
      } else {
        // لا زالت هناك محاولات متبقية
        db.prepare(`
          UPDATE targets
          SET error_message = ?
          WHERE id = ?
        `).run(result.error || 'Unknown error', target.id);
        
        console.log(`⚠️  [Campaign ${campaignId}] Failed attempt ${currentRetryCount}/${campaign.pacing_retry_attempts} to ${target.username}: ${result.error} - will retry`);
      }
      
      // تأخير قصير بعد الفشل
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

  } catch (error) {
    console.error(`❌ Error processing campaign ${campaignId}:`, error);
  } finally {
    // ✅ إزالة الحملة من قائمة المعالجة
    processingCampaigns.delete(campaignId);
  }
}

// استئناف الحملات النشطة عند بدء التشغيل
export function resumeActiveCampaigns() {
  const campaigns = db.prepare(`
    SELECT id FROM campaigns WHERE status = 'active'
  `).all() as Array<{ id: number }>;

  for (const campaign of campaigns) {
    startCampaign(campaign.id);
  }

  console.log(`Resumed ${campaigns.length} active campaigns`);
}
