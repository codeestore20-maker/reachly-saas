import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { query, encrypt, initializeDatabase } from './db-postgres';
import { hashPassword, verifyPassword, generateToken, verifyToken, createUser, getUserByEmail } from './auth';
import { parseCookies, validateTwitterAccount, extractFollowers } from './twitter';
import { startCampaign, pauseCampaign, stopCampaign, resumeActiveCampaigns } from './campaign-runner';
import { startFollowCampaign, pauseFollowCampaign, stopFollowCampaign, resumeActiveFollowCampaigns } from './follow-runner';
import { getQueueStats } from './queue';
import { adminMiddleware, checkLimit } from './middleware';
import { 
  getUserSubscription, 
  incrementUsage, 
  changeUserPlan, 
  resetUserUsage,
  getAllPlans,
  getPlanById,
  updatePlan,
  getAllUsersWithSubscriptions,
  getSystemStats
} from './subscription';

// ============ Helper Functions for Settings Normalization ============

/**
 * Normalize follow campaign settings from various input formats
 * Accepts both 'settings' (from UI) and 'pacing' (legacy) formats
 * Calculates delay from followsPerMinute to respect user settings
 */
function normalizeFollowSettings(input: any) {
  const source = input.settings || input.pacing || {};
  
  // Get follows per minute (primary control)
  const perMinute = source.followsPerMinute || source.perMinute || 3;
  
  // Calculate base delay from follows per minute
  const baseDelay = 60 / perMinute;  // seconds per follow
  
  // Apply random variation if enabled (±20%)
  const randomDelay = source.randomDelay !== false;  // default true
  
  return {
    perMinute: perMinute,
    dailyCap: source.dailyCap || 50,
    delayMin: Math.round(randomDelay ? baseDelay * 0.8 : baseDelay),
    delayMax: Math.round(randomDelay ? baseDelay * 1.2 : baseDelay),
    retryAttempts: source.retryAttempts || 2
  };
}

/**
 * Normalize DM campaign settings (similar to follow campaigns)
 */
function normalizeDMSettings(input: any) {
  const source = input.settings || input.pacing || {};
  
  // Get messages per minute (primary control)
  const perMinute = source.messagesPerMinute || source.perMinute || 15;
  
  // Calculate base delay from messages per minute
  const baseDelay = 60 / perMinute;  // seconds per message
  
  // Apply random variation if enabled (±20%)
  const randomDelay = source.randomDelay !== false;  // default true
  
  return {
    perMinute: perMinute,
    dailyCap: source.dailyCap || Math.floor((86400 / baseDelay) * 0.8),  // 80% of theoretical max
    delayMin: Math.round(randomDelay ? baseDelay * 0.8 : baseDelay),
    delayMax: Math.round(randomDelay ? baseDelay * 1.2 : baseDelay),
    retryAttempts: source.retryAttempts || 2
  };
}

/**
 * Format campaign settings from database to UI format
 */
function formatFollowSettings(campaign: any) {
  return {
    followsPerMinute: campaign.pacing_per_minute || 0,
    dailyCap: campaign.pacing_daily_cap || 0,
    randomDelay: campaign.pacing_delay_min !== campaign.pacing_delay_max,
    autoPauseOnHighFailure: false  // Not implemented yet
  };
}
import logger from './logger';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy for Railway/production environment
if (isProduction) {
  app.set('trust proxy', 1);
}

// ============ Middleware ============

// In production, allow same-origin requests (when origin is undefined)
// In development, allow localhost
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'https://reachly-saas-production.up.railway.app'
];

// Add FRONTEND_URL if set
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin requests in production)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Allow requests from allowed origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Increased for development
  message: 'Too many login attempts, please try again later',
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
});

app.use('/api/', apiLimiter);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ============ Health Check ============

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    const queueStats = await getQueueStats();
    
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      redis: 'connected',
      queues: queueStats,
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({ status: 'unhealthy', error: (error as Error).message });
  }
});

// ============ Auth Middleware ============

function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  
  req.user = user;
  next();
}

// ============ Auth Routes ============

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const existing = await getUserByEmail(email);
    if (existing) return res.status(400).json({ error: 'Email already exists' });
    
    const passwordHash = await hashPassword(password);
    const userId = await createUser(email, passwordHash);
    const user = { id: userId, email };
    const token = generateToken(user);
    
    logger.info('User signed up', { userId, email });
    res.json({ user, token });
  } catch (error) {
    logger.error('Signup error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    logger.info('User logged in', { userId: user.id, role: user.role });
    res.json({ user: { id: user.id, email: user.email, role: user.role }, token });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ Accounts Routes ============

app.get('/api/accounts', authMiddleware, async (req: any, res) => {
  try {
    const result = await query(`
      SELECT id, username, handle, avatar, is_valid, last_validated, created_at
      FROM accounts WHERE user_id = $1 ORDER BY created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    logger.error('Get accounts error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/accounts', authMiddleware, checkLimit('add_account'), async (req: any, res) => {
  try {
    const { username, cookies } = req.body;
    if (!username || !cookies) return res.status(400).json({ error: 'Username and cookies required' });
    
    const parsedCookies = parseCookies(cookies);
    const validation = await validateTwitterAccount(parsedCookies, username);
    if (!validation.valid) return res.status(400).json({ error: validation.error || 'Invalid account' });
    
    const encryptedCookies = encrypt(JSON.stringify(parsedCookies));
    const result = await query(`
      INSERT INTO accounts (user_id, username, handle, avatar, encrypted_cookies)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, handle, avatar, is_valid, last_validated
    `, [req.user.id, validation.username, '@' + validation.username, validation.avatar, encryptedCookies]);
    
    logger.info('Account added', { userId: req.user.id, username: validation.username });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Add account error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/accounts/:id', authMiddleware, async (req: any, res) => {
  try {
    await query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    logger.info('Account deleted', { accountId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete account error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ Extract Followers Route ============

app.post('/api/extract-followers', authMiddleware, async (req: any, res) => {
  try {
    const { accountId, targetUsername, quantity } = req.body;
    
    if (!accountId || !targetUsername || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get account
    const accountResult = await query(
      'SELECT * FROM accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.user.id]
    );

    if (!accountResult.rows[0]) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountResult.rows[0];

    // Extract followers
    logger.info('Extracting followers', { accountId, targetUsername, quantity });
    const followers = await extractFollowers(account.encrypted_cookies, targetUsername, quantity);

    if (!followers || followers.length === 0) {
      return res.status(400).json({ error: 'No followers found or failed to extract' });
    }

    // Store followers in database
    for (const follower of followers) {
      await query(`
        INSERT INTO followers (user_id, account_id, username, name, profile_url, extracted_from)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, username) DO UPDATE SET
          name = EXCLUDED.name,
          profile_url = EXCLUDED.profile_url,
          extracted_from = EXCLUDED.extracted_from
      `, [
        req.user.id,
        accountId,
        follower.username,
        follower.name,
        follower.avatar,
        targetUsername
      ]);
    }

    logger.info('Followers extracted successfully', { 
      accountId, 
      targetUsername, 
      count: followers.length 
    });

    // Return array directly for frontend compatibility
    res.json(followers);

  } catch (error) {
    logger.error('Extract followers error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ Campaigns Routes ============

app.get('/api/campaigns', authMiddleware, async (req: any, res) => {
  try {
    const result = await query(`
      SELECT c.*, a.username as account_username, a.handle as account_handle
      FROM campaigns c JOIN accounts a ON c.account_id = a.id
      WHERE c.user_id = $1 ORDER BY c.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    logger.error('Get campaigns error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/campaigns/:id', authMiddleware, async (req: any, res) => {
  try {
    const campaignResult = await query(`
      SELECT c.*, a.username as account_username, a.handle as account_handle
      FROM campaigns c JOIN accounts a ON c.account_id = a.id
      WHERE c.id = $1 AND c.user_id = $2
    `, [req.params.id, req.user.id]);
    
    if (!campaignResult.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    
    const targetsResult = await query('SELECT * FROM targets WHERE campaign_id = $1 ORDER BY updated_at DESC NULLS LAST, created_at ASC', [req.params.id]);
    res.json({ ...campaignResult.rows[0], targets: targetsResult.rows });
  } catch (error) {
    logger.error('Get campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/campaigns', authMiddleware, checkLimit('create_dm_campaign'), async (req: any, res) => {
  try {
    const { name, accountId, tags, targetSource, manualTargets, selectedFollowers, message, pacing, isDraft } = req.body;
    if (!name || !accountId || !message) return res.status(400).json({ error: 'Missing required fields' });
    
    // Normalize settings from UI format (supports both 'settings' and 'pacing')
    const pacingSettings = normalizeDMSettings(req.body);
    
    // Set status based on isDraft flag
    const status = isDraft ? 'draft' : 'pending';
    
    const result = await query(`
      INSERT INTO campaigns (user_id, account_id, name, status, target_source, message_template, tags,
        pacing_per_minute, pacing_delay_min, pacing_delay_max, pacing_daily_cap, pacing_retry_attempts)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
    `, [req.user.id, accountId, name, status, targetSource, message, tags ? JSON.stringify(tags) : null,
        pacingSettings.perMinute, pacingSettings.delayMin, pacingSettings.delayMax, 
        pacingSettings.dailyCap, pacingSettings.retryAttempts]);
    
    const campaignId = result.rows[0].id;
    let targets: any[] = [];
    
    if (targetSource === 'manual' && manualTargets) {
      const usernames = manualTargets.split(/[\n,]/).map((u: string) => u.trim().replace('@', '')).filter(Boolean);
      targets = usernames.map((username: string) => ({ username, name: username }));
    } else if (targetSource === 'followers' && selectedFollowers) {
      targets = selectedFollowers;
    }
    
    if (targets.length > 0) {
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        await query(`INSERT INTO targets (campaign_id, user_id, username, name, avatar, created_at) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${i} milliseconds')`,
          [campaignId, target.id || target.username, target.username, target.name || target.username, target.avatar || null]);
      }
      await query('UPDATE campaigns SET stats_total = $1 WHERE id = $2', [targets.length, campaignId]);
    }
    
    const campaignResult = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    logger.info('Campaign created', { campaignId, userId: req.user.id });
    res.json(campaignResult.rows[0]);
  } catch (error) {
    logger.error('Create campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/campaigns/:id/start', authMiddleware, async (req: any, res) => {
  try {
    const result = await query('SELECT * FROM campaigns WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    
    startCampaign(Number(req.params.id));
    logger.info('Campaign started', { campaignId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Start campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/campaigns/:id/pause', authMiddleware, (req: any, res) => {
  try {
    pauseCampaign(Number(req.params.id));
    logger.info('Campaign paused', { campaignId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Pause campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/campaigns/:id/stop', authMiddleware, (req: any, res) => {
  try {
    stopCampaign(Number(req.params.id));
    logger.info('Campaign stopped', { campaignId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Stop campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update campaign draft
app.put('/api/campaigns/:id', authMiddleware, async (req: any, res) => {
  try {
    const { name, accountId, tags, targetSource, manualTargets, selectedFollowers, message, pacing } = req.body;
    
    const campaignCheck = await query('SELECT * FROM campaigns WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!campaignCheck.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    
    // Normalize settings from UI format (supports both 'settings' and 'pacing')
    const pacingSettings = normalizeDMSettings(req.body);
    
    await query(`
      UPDATE campaigns SET 
        name = $1, account_id = $2, tags = $3, target_source = $4, message_template = $5,
        pacing_per_minute = $6, pacing_delay_min = $7, pacing_delay_max = $8, 
        pacing_daily_cap = $9, pacing_retry_attempts = $10
      WHERE id = $11 AND user_id = $12
    `, [name, accountId, tags ? JSON.stringify(tags) : null, targetSource, message,
        pacingSettings.perMinute, pacingSettings.delayMin, pacingSettings.delayMax,
        pacingSettings.dailyCap, pacingSettings.retryAttempts, req.params.id, req.user.id]);
    
    // Update targets if provided
    if (targetSource === 'manual' && manualTargets) {
      await query('DELETE FROM targets WHERE campaign_id = $1', [req.params.id]);
      const usernames = manualTargets.split(/[\n,]/).map((u: string) => u.trim().replace('@', '')).filter(Boolean);
      for (const username of usernames) {
        await query(`INSERT INTO targets (campaign_id, user_id, username, name) VALUES ($1, $2, $3, $4)`,
          [req.params.id, username, username, username]);
      }
      await query('UPDATE campaigns SET stats_total = $1 WHERE id = $2', [usernames.length, req.params.id]);
    } else if (targetSource === 'followers' && selectedFollowers) {
      await query('DELETE FROM targets WHERE campaign_id = $1', [req.params.id]);
      for (const target of selectedFollowers) {
        await query(`INSERT INTO targets (campaign_id, user_id, username, name, avatar) VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, target.id || target.username, target.username, target.name || target.username, target.avatar || null]);
      }
      await query('UPDATE campaigns SET stats_total = $1 WHERE id = $2', [selectedFollowers.length, req.params.id]);
    }
    
    const updatedCampaign = await query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    logger.info('Campaign draft updated', { campaignId: req.params.id });
    res.json(updatedCampaign.rows[0]);
  } catch (error) {
    logger.error('Update campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ Follow Campaigns Routes ============

app.get('/api/follow-campaigns', authMiddleware, async (req: any, res) => {
  try {
    const result = await query(`
      SELECT c.*, a.username as account_username, a.handle as account_handle, a.avatar as account_avatar
      FROM follow_campaigns c JOIN accounts a ON c.account_id = a.id
      WHERE c.user_id = $1 ORDER BY c.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    logger.error('Get follow campaigns error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/follow-campaigns/:id', authMiddleware, async (req: any, res) => {
  try {
    const campaignResult = await query(`
      SELECT c.*, a.username as account_username, a.handle as account_handle
      FROM follow_campaigns c JOIN accounts a ON c.account_id = a.id
      WHERE c.id = $1 AND c.user_id = $2
    `, [req.params.id, req.user.id]);
    
    if (!campaignResult.rows[0]) return res.status(404).json({ error: 'Follow campaign not found' });
    
    const campaign = campaignResult.rows[0];
    const targetsResult = await query('SELECT * FROM follow_targets WHERE campaign_id = $1 ORDER BY updated_at DESC NULLS LAST, created_at ASC', [req.params.id]);
    
    // Format settings for UI
    const formattedCampaign = {
      ...campaign,
      settings: formatFollowSettings(campaign),
      targets: targetsResult.rows
    };
    
    res.json(formattedCampaign);
  } catch (error) {
    logger.error('Get follow campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/follow-campaigns', authMiddleware, checkLimit('create_follow_campaign'), async (req: any, res) => {
  try {
    const { name, accountId, targetSource, manualTargets, selectedFollowers, isDraft } = req.body;
    if (!name || !accountId) return res.status(400).json({ error: 'Missing required fields' });
    
    // Normalize settings from UI format (supports both 'settings' and 'pacing')
    const pacingSettings = normalizeFollowSettings(req.body);
    
    // Set status based on isDraft flag
    const status = isDraft ? 'draft' : 'pending';
    
    const result = await query(`
      INSERT INTO follow_campaigns (user_id, account_id, name, status, target_source,
        pacing_per_minute, pacing_delay_min, pacing_delay_max, pacing_daily_cap, pacing_retry_attempts)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `, [req.user.id, accountId, name, status, targetSource,
        pacingSettings.perMinute, pacingSettings.delayMin, pacingSettings.delayMax, 
        pacingSettings.dailyCap, pacingSettings.retryAttempts]);
    
    const campaignId = result.rows[0].id;
    let targets: any[] = [];
    
    if (targetSource === 'manual' && manualTargets) {
      const usernames = manualTargets.split(/[\n,]/).map((u: string) => u.trim().replace('@', '')).filter(Boolean);
      targets = usernames.map((username: string) => ({ username, name: username }));
    } else if (targetSource === 'followers' && selectedFollowers) {
      targets = selectedFollowers;
    }
    
    if (targets.length > 0) {
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        await query(`INSERT INTO follow_targets (campaign_id, user_id, username, name, avatar, created_at) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${i} milliseconds')`,
          [campaignId, target.id || target.username, target.username, target.name || target.username, target.avatar || null]);
      }
      await query('UPDATE follow_campaigns SET stats_total = $1 WHERE id = $2', [targets.length, campaignId]);
    }
    
    const campaignResult = await query('SELECT * FROM follow_campaigns WHERE id = $1', [campaignId]);
    logger.info('Follow campaign created', { campaignId, userId: req.user.id });
    res.json(campaignResult.rows[0]);
  } catch (error) {
    logger.error('Create follow campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/follow-campaigns/:id/start', authMiddleware, async (req: any, res) => {
  try {
    const result = await query('SELECT * FROM follow_campaigns WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Follow campaign not found' });
    
    startFollowCampaign(Number(req.params.id));
    logger.info('Follow campaign started', { campaignId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Start follow campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/follow-campaigns/:id/pause', authMiddleware, (req: any, res) => {
  try {
    pauseFollowCampaign(Number(req.params.id));
    logger.info('Follow campaign paused', { campaignId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Pause follow campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/follow-campaigns/:id/stop', authMiddleware, (req: any, res) => {
  try {
    stopFollowCampaign(Number(req.params.id));
    logger.info('Follow campaign stopped', { campaignId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Stop follow campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update follow campaign draft
app.put('/api/follow-campaigns/:id', authMiddleware, async (req: any, res) => {
  try {
    const { name, accountId, targetSource, manualTargets, selectedFollowers } = req.body;
    
    const campaignCheck = await query('SELECT * FROM follow_campaigns WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!campaignCheck.rows[0]) return res.status(404).json({ error: 'Follow campaign not found' });
    
    // Normalize settings from UI format (supports both 'settings' and 'pacing')
    const pacingSettings = normalizeFollowSettings(req.body);
    
    await query(`
      UPDATE follow_campaigns SET 
        name = $1, account_id = $2, target_source = $3,
        pacing_per_minute = $4, pacing_delay_min = $5, pacing_delay_max = $6, 
        pacing_daily_cap = $7, pacing_retry_attempts = $8
      WHERE id = $9 AND user_id = $10
    `, [name, accountId, targetSource,
        pacingSettings.perMinute, pacingSettings.delayMin, pacingSettings.delayMax,
        pacingSettings.dailyCap, pacingSettings.retryAttempts, req.params.id, req.user.id]);
    
    // Update targets if provided
    if (targetSource === 'manual' && manualTargets) {
      await query('DELETE FROM follow_targets WHERE campaign_id = $1', [req.params.id]);
      const usernames = manualTargets.split(/[\n,]/).map((u: string) => u.trim().replace('@', '')).filter(Boolean);
      for (const username of usernames) {
        await query(`INSERT INTO follow_targets (campaign_id, username, name, handle) VALUES ($1, $2, $3, $4)`,
          [req.params.id, username, username, '@' + username]);
      }
      await query('UPDATE follow_campaigns SET stats_total = $1 WHERE id = $2', [usernames.length, req.params.id]);
    } else if (targetSource === 'followers' && selectedFollowers) {
      await query('DELETE FROM follow_targets WHERE campaign_id = $1', [req.params.id]);
      for (const target of selectedFollowers) {
        await query(`INSERT INTO follow_targets (campaign_id, username, name, handle, avatar) VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, target.username, target.name || target.username, target.handle || '@' + target.username, target.avatar || null]);
      }
      await query('UPDATE follow_campaigns SET stats_total = $1 WHERE id = $2', [selectedFollowers.length, req.params.id]);
    }
    
    const updatedCampaign = await query('SELECT * FROM follow_campaigns WHERE id = $1', [req.params.id]);
    logger.info('Follow campaign draft updated', { campaignId: req.params.id });
    res.json(updatedCampaign.rows[0]);
  } catch (error) {
    logger.error('Update follow campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ Dashboard Stats ============

app.get('/api/dashboard/stats', authMiddleware, async (req: any, res) => {
  try {
    const statsResult = await query(`
      SELECT SUM(stats_sent) as total_sent, SUM(stats_replied) as total_replied,
             SUM(stats_failed) as total_failed, COUNT(CASE WHEN status = 'active' THEN 1 END) as active_campaigns
      FROM campaigns WHERE user_id = $1
    `, [req.user.id]);
    
    const accountResult = await query('SELECT COUNT(*) as count FROM accounts WHERE user_id = $1', [req.user.id]);
    const stats = statsResult.rows[0];
    
    res.json({
      totalDMs: stats.total_sent || 0,
      activeCampaigns: stats.active_campaigns || 0,
      connectedAccounts: accountResult.rows[0].count || 0,
      replyRate: stats.total_sent > 0 ? ((stats.total_replied || 0) / stats.total_sent * 100).toFixed(1) : '0.0'
    });
  } catch (error) {
    logger.error('Get dashboard stats error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ User Settings Routes ============

// Get user profile
app.get('/api/user/profile', authMiddleware, async (req: any, res) => {
  try {
    const result = await query('SELECT id, email, first_name, last_name, avatar, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get profile error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update user profile
app.put('/api/user/profile', authMiddleware, async (req: any, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    
    await query(`
      UPDATE users SET 
        first_name = $1, 
        last_name = $2, 
        email = $3
      WHERE id = $4
    `, [firstName, lastName, email, req.user.id]);
    
    const updatedUser = await query('SELECT id, email, first_name, last_name, avatar, created_at FROM users WHERE id = $1', [req.user.id]);
    logger.info('User profile updated', { userId: req.user.id });
    res.json(updatedUser.rows[0]);
  } catch (error) {
    logger.error('Update user profile error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update password
app.put('/api/user/password', authMiddleware, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    // Get current user
    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, req.user.id]);
    
    logger.info('User password updated', { userId: req.user.id });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Update password error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ Serve Static Files (Production) ============

if (isProduction) {
  const distPath = path.join(__dirname, '../dist');
  
  // Serve static files with fallback to index.html
  app.use(express.static(distPath, { 
    index: 'index.html',
    fallthrough: true 
  }));
  
  // Fallback for SPA routes - only for non-API routes
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
}

// ============ Subscription & Admin APIs ============

// Get user's subscription info
app.get('/api/subscription', authMiddleware, async (req: any, res) => {
  try {
    const subscription = await getUserSubscription(req.user.id);
    res.json(subscription);
  } catch (error) {
    logger.error('Get subscription error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all plans
app.get('/api/plans', async (req, res) => {
  try {
    const plans = await getAllPlans();
    res.json(plans);
  } catch (error) {
    logger.error('Get plans error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ Admin APIs ============

// Get all users (admin only)
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await getAllUsersWithSubscriptions();
    res.json(users);
  } catch (error) {
    logger.error('Admin get users error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Change user plan (admin only)
app.post('/api/admin/users/:userId/plan', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { planId } = req.body;
    
    await changeUserPlan(parseInt(userId), planId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Admin change plan error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Reset user usage (admin only)
app.post('/api/admin/users/:userId/reset-usage', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    await resetUserUsage(parseInt(userId));
    res.json({ success: true });
  } catch (error) {
    logger.error('Admin reset usage error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all plans (admin only - with edit capability)
app.get('/api/admin/plans', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const plans = await query(`
      SELECT 
        sp.*,
        COUNT(us.id) as subscriber_count
      FROM subscription_plans sp
      LEFT JOIN user_subscriptions us ON sp.id = us.plan_id
      GROUP BY sp.id
      ORDER BY sp.display_order
    `);
    res.json(plans.rows);
  } catch (error) {
    logger.error('Admin get plans error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update plan (admin only)
app.put('/api/admin/plans/:planId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { planId } = req.params;
    const updates = req.body;
    
    await updatePlan(parseInt(planId), updates);
    res.json({ success: true });
  } catch (error) {
    logger.error('Admin update plan error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get system stats (admin only)
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.json(stats);
  } catch (error) {
    logger.error('Admin get stats error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============ Server Start ============

async function startServer() {
  try {
    // Initialize database first
    await initializeDatabase();
    
    // Then start the server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${isProduction ? 'production' : 'development'}`);
      resumeActiveCampaigns();
      resumeActiveFollowCampaigns();
    });
  } catch (error) {
    logger.error('❌ Failed to start server', { error });
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
