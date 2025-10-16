import Bull from 'bull';
import Redis from 'ioredis';
import logger from './logger';

// ============ Redis Configuration ============

// إنشاء Redis client للاستخدام العام
// Only if REDIS_URL is explicitly set and not empty
let redisClient: Redis | null = null;
const redisUrl = process.env.REDIS_URL?.trim();

// Debug: Log Redis URL status
if (process.env.REDIS_URL) {
  logger.info(`🔍 REDIS_URL found: ${redisUrl?.substring(0, 20)}...`);
} else {
  logger.info('🔍 REDIS_URL not found in environment');
}

if (redisUrl && redisUrl.length > 0 && redisUrl.startsWith('redis')) {
  logger.info('🔄 Connecting to Redis...');
  logger.info(`🔗 Redis URL: ${redisUrl.includes('railway.internal') ? 'Internal Railway Network' : 'Public Network'}`);
  
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true, // Don't connect immediately
    connectTimeout: 10000, // 10 seconds timeout
    retryStrategy: (times) => {
      if (times > 3) {
        logger.error('❌ Redis connection failed after 3 attempts');
        logger.error('💡 Tip: Make sure Redis service is running and accessible');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 1000, 3000);
      logger.info(`⏳ Retry ${times}/3 in ${delay}ms...`);
      return delay;
    },
    reconnectOnError: (err) => {
      logger.error('❌ Redis error, attempting reconnect...', { error: err.message });
      return true;
    },
  });

  redisClient.on('connect', () => {
    logger.info('✅ Connected to Redis');
  });

  redisClient.on('error', (err) => {
    logger.error('❌ Redis connection error', { error: err.message });
  });

  redisClient.on('close', () => {
    logger.warn('⚠️  Redis connection closed');
  });

  // Try to connect
  redisClient.connect().catch((err) => {
    logger.error('❌ Failed to connect to Redis', { error: err.message });
    redisClient = null; // Disable Redis if connection fails
  });
} else {
  logger.warn('⚠️  REDIS_URL not set - Queue system disabled');
}

export { redisClient };

// ============ Bull Queue Configuration ============

let campaignQueue: Bull.Queue | null = null;
let followQueue: Bull.Queue | null = null;

// Don't initialize queues at all if Redis is not available
if (redisUrl && redisUrl.length > 0 && redisUrl.startsWith('redis')) {
  // Wait a bit for Redis connection to establish
  setTimeout(() => {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const queueOptions = {
          redis: redisUrl,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential' as const,
              delay: 2000,
            },
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        };

        // ============ Campaign Queues ============

        campaignQueue = new Bull('dm-campaigns', queueOptions);

        campaignQueue.on('error', (error) => {
          logger.error('❌ Campaign queue error', { error: error.message });
        });

        campaignQueue.on('completed', (job, result) => {
          logger.info('✅ Campaign job completed', { jobId: job.id, result });
        });

        campaignQueue.on('failed', (job, err) => {
          logger.error('❌ Campaign job failed', { jobId: job?.id, error: err.message });
        });

        followQueue = new Bull('follow-campaigns', queueOptions);

        followQueue.on('error', (error) => {
          logger.error('❌ Follow queue error', { error: error.message });
        });

        followQueue.on('completed', (job, result) => {
          logger.info('✅ Follow job completed', { jobId: job.id, result });
        });

        followQueue.on('failed', (job, err) => {
          logger.error('❌ Follow job failed', { jobId: job?.id, error: err.message });
        });

        logger.info('✅ Queue system initialized');
      } catch (error) {
        logger.error('❌ Failed to initialize queue system', { error });
        logger.warn('⚠️  Continuing without queue system');
      }
    } else {
      logger.warn('⚠️  Redis not ready - Queue system disabled');
    }
  }, 1000); // Wait 1 second for Redis to connect
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
