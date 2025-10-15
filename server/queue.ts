import Bull from 'bull';
import Redis from 'ioredis';
import logger from './logger';

// ============ Redis Configuration ============

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// إنشاء Redis client للاستخدام العام
// Temporarily disabled if REDIS_URL is not set
let redisClient: Redis | null = null;

if (process.env.REDIS_URL) {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redisClient.on('connect', () => {
    logger.info('✅ Connected to Redis');
  });

  redisClient.on('error', (err) => {
    logger.error('❌ Redis connection error', { error: err });
  });
} else {
  logger.warn('⚠️  REDIS_URL not set - Queue system disabled');
}

export { redisClient };

// ============ Bull Queue Configuration ============

let campaignQueue: Bull.Queue | null = null;
let followQueue: Bull.Queue | null = null;

if (process.env.REDIS_URL) {
  const queueOptions = {
    redis: redisUrl,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  };

  // ============ Campaign Queues ============

  campaignQueue = new Bull('dm-campaigns', queueOptions);

  campaignQueue.on('error', (error) => {
    logger.error('❌ Campaign queue error', { error });
  });

  campaignQueue.on('completed', (job, result) => {
    logger.info('✅ Campaign job completed', { jobId: job.id, result });
  });

  campaignQueue.on('failed', (job, err) => {
    logger.error('❌ Campaign job failed', { jobId: job?.id, error: err });
  });

  followQueue = new Bull('follow-campaigns', queueOptions);

  followQueue.on('error', (error) => {
    logger.error('❌ Follow queue error', { error });
  });

  followQueue.on('completed', (job, result) => {
    logger.info('✅ Follow job completed', { jobId: job.id, result });
  });

  followQueue.on('failed', (job, err) => {
    logger.error('❌ Follow job failed', { jobId: job?.id, error: err });
  });

  logger.info('✅ Queue system initialized');
} else {
  logger.warn('⚠️  Queue system disabled - REDIS_URL not set');
}

export { campaignQueue, followQueue };

// ============ Queue Helper Functions ============

/**
 * Add a campaign to the processing queue
 */
export async function addCampaignJob(campaignId: number): Promise<void> {
  if (!campaignQueue) {
    logger.warn('⚠️  Queue system disabled - cannot add campaign job');
    return;
  }
  try {
    await campaignQueue.add(
      'process-campaign',
      { campaignId },
      {
        jobId: `campaign-${campaignId}`,
        repeat: {
          every: 1000,
        },
      }
    );
    logger.info('✅ Campaign job added to queue', { campaignId });
  } catch (error) {
    logger.error('❌ Failed to add campaign job', { campaignId, error });
    throw error;
  }
}

/**
 * Remove a campaign from the processing queue
 */
export async function removeCampaignJob(campaignId: number): Promise<void> {
  if (!campaignQueue) return;
  try {
    const jobId = `campaign-${campaignId}`;
    const job = await campaignQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info('✅ Campaign job removed from queue', { campaignId });
    }
  } catch (error) {
    logger.error('❌ Failed to remove campaign job', { campaignId, error });
    throw error;
  }
}

/**
 * Add a follow campaign to the processing queue
 */
export async function addFollowJob(campaignId: number): Promise<void> {
  if (!followQueue) {
    logger.warn('⚠️  Queue system disabled - cannot add follow job');
    return;
  }
  try {
    await followQueue.add(
      'process-follow',
      { campaignId },
      {
        jobId: `follow-${campaignId}`,
        repeat: {
          every: 1000, // Check every second
        },
      }
    );
    logger.info('✅ Follow job added to queue', { campaignId });
  } catch (error) {
    logger.error('❌ Failed to add follow job', { campaignId, error });
    throw error;
  }
}

/**
 * Remove a follow campaign from the processing queue
 */
export async function removeFollowJob(campaignId: number): Promise<void> {
  if (!followQueue) return;
  try {
    const jobId = `follow-${campaignId}`;
    const job = await followQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info('✅ Follow job removed from queue', { campaignId });
    }
  } catch (error) {
    logger.error('❌ Failed to remove follow job', { campaignId, error });
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  if (!campaignQueue || !followQueue) {
    return {
      campaigns: { waiting: 0, active: 0, completed: 0, failed: 0 },
      follows: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };
  }
  try {
    const [
      campaignWaiting,
      campaignActive,
      campaignCompleted,
      campaignFailed,
      followWaiting,
      followActive,
      followCompleted,
      followFailed,
    ] = await Promise.all([
      campaignQueue.getWaitingCount(),
      campaignQueue.getActiveCount(),
      campaignQueue.getCompletedCount(),
      campaignQueue.getFailedCount(),
      followQueue.getWaitingCount(),
      followQueue.getActiveCount(),
      followQueue.getCompletedCount(),
      followQueue.getFailedCount(),
    ]);

    return {
      campaigns: {
        waiting: campaignWaiting,
        active: campaignActive,
        completed: campaignCompleted,
        failed: campaignFailed,
      },
      follows: {
        waiting: followWaiting,
        active: followActive,
        completed: followCompleted,
        failed: followFailed,
      },
    };
  } catch (error) {
    logger.error('❌ Failed to get queue stats', { error });
    throw error;
  }
}

/**
 * Clean old jobs from queues
 */
export async function cleanQueues(): Promise<void> {
  if (!campaignQueue || !followQueue) return;
  try {
    await Promise.all([
      campaignQueue.clean(24 * 3600 * 1000, 'completed'),
      campaignQueue.clean(7 * 24 * 3600 * 1000, 'failed'),
      followQueue.clean(24 * 3600 * 1000, 'completed'),
      followQueue.clean(7 * 24 * 3600 * 1000, 'failed'),
    ]);
    logger.info('✅ Queues cleaned successfully');
  } catch (error) {
    logger.error('❌ Failed to clean queues', { error });
  }
}

// Clean queues every 6 hours
if (campaignQueue && followQueue) {
  setInterval(cleanQueues, 6 * 60 * 60 * 1000);
}
