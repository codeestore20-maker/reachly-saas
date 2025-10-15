import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { query, encrypt, initializeDatabase } from './db-postgres';
import { hashPassword, verifyPassword, generateToken, verifyToken, createUser, getUserByEmail } from './auth';
import { parseCookies, validateTwitterAccount, extractFollowers } from './twitter';
import { startCampaign, pauseCampaign, stopCampaign, resumeActiveCampaigns } from './campaign-runner-disabled';
import { startFollowCampaign, pauseFollowCampaign, stopFollowCampaign, resumeActiveFollowCampaigns } from './follow-runner-disabled';
import { getQueueStats } from './queue';
import logger from './logger';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// ============ Middleware ============

const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL, 'http://localhost:8080']
  : ['http://localhost:8080'];

app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
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
    
    const token = generateToken({ id: user.id, email: user.email });
    logger.info('User logged in', { userId: user.id });
    res.json({ user: { id: user.id, email: user.email }, token });
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

app.post('/api/accounts', authMiddleware, async (req: any, res) => {
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
    
    const targetsResult = await query('SELECT * FROM targets WHERE campaign_id = $1', [req.params.id]);
    res.json({ ...campaignResult.rows[0], targets: targetsResult.rows });
  } catch (error) {
    logger.error('Get campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/campaigns', authMiddleware, async (req: any, res) => {
  try {
    const { name, accountId, tags, targetSource, manualTargets, selectedFollowers, message, pacing } = req.body;
    if (!name || !accountId || !message) return res.status(400).json({ error: 'Missing required fields' });
    
    const result = await query(`
      INSERT INTO campaigns (user_id, account_id, name, status, target_source, message_template, tags,
        pacing_per_minute, pacing_delay_min, pacing_delay_max, pacing_daily_cap, pacing_retry_attempts)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
    `, [req.user.id, accountId, name, 'draft', targetSource, message, tags ? JSON.stringify(tags) : null,
        pacing.perMinute, pacing.delayMin, pacing.delayMax, pacing.dailyCap, pacing.retryAttempts]);
    
    const campaignId = result.rows[0].id;
    let targets: any[] = [];
    
    if (targetSource === 'manual' && manualTargets) {
      const usernames = manualTargets.split(/[\n,]/).map((u: string) => u.trim().replace('@', '')).filter(Boolean);
      targets = usernames.map((username: string) => ({ username, name: username }));
    } else if (targetSource === 'followers' && selectedFollowers) {
      targets = selectedFollowers;
    }
    
    if (targets.length > 0) {
      for (const target of targets) {
        await query(`INSERT INTO targets (campaign_id, user_id, username, name, avatar) VALUES ($1, $2, $3, $4, $5)`,
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
    
    const targetsResult = await query('SELECT * FROM follow_targets WHERE campaign_id = $1', [req.params.id]);
    res.json({ ...campaignResult.rows[0], targets: targetsResult.rows });
  } catch (error) {
    logger.error('Get follow campaign error', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/follow-campaigns', authMiddleware, async (req: any, res) => {
  try {
    const { name, accountId, targetSource, manualTargets, selectedFollowers, pacing } = req.body;
    if (!name || !accountId) return res.status(400).json({ error: 'Missing required fields' });
    
    const result = await query(`
      INSERT INTO follow_campaigns (user_id, account_id, name, status, target_source,
        pacing_per_minute, pacing_delay_min, pacing_delay_max, pacing_daily_cap, pacing_retry_attempts)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `, [req.user.id, accountId, name, 'draft', targetSource,
        pacing.perMinute, pacing.delayMin, pacing.delayMax, pacing.dailyCap, pacing.retryAttempts]);
    
    const campaignId = result.rows[0].id;
    let targets: any[] = [];
    
    if (targetSource === 'manual' && manualTargets) {
      const usernames = manualTargets.split(/[\n,]/).map((u: string) => u.trim().replace('@', '')).filter(Boolean);
      targets = usernames.map((username: string) => ({ username, name: username }));
    } else if (targetSource === 'followers' && selectedFollowers) {
      targets = selectedFollowers;
    }
    
    if (targets.length > 0) {
      for (const target of targets) {
        await query(`INSERT INTO follow_targets (campaign_id, user_id, username, name, avatar) VALUES ($1, $2, $3, $4, $5)`,
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

// ============ Followers Routes ============

app.post('/api/followers/extract', authMiddleware, async (req: any, res) => {
  try {
    const { accountId, targetUsername, quantity } = req.body;
    if (!accountId || !targetUsername) return res.status(400).json({ error: 'Account ID and target username required' });
    
    const result = await query('SELECT encrypted_cookies FROM accounts WHERE id = $1 AND user_id = $2', [accountId, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Account not found' });
    
    const followers = await extractFollowers(result.rows[0].encrypted_cookies, targetUsername, quantity || 100);
    logger.info('Followers extracted', { userId: req.user.id, count: followers.length });
    res.json(followers);
  } catch (error) {
    logger.error('Extract followers error', { error });
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

// ============ Serve Static Files (Production) ============

if (isProduction) {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  
  // Catch-all route for SPA - must be last
  app.get('/*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

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
