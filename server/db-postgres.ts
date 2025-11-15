import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import logger from './logger';

// ============ إعداد PostgreSQL Connection ============

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // maximum number of clients
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  logger.info('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('❌ Unexpected error on idle client', { error: err });
  process.exit(-1);
});

// ============ نظام التشفير المحسّن ============

/**
 * دالة للحصول على مفتاح التشفير بشكل آمن
 */
function getEncryptionKey(): string {
  const envPath = path.join(process.cwd(), '.env.local');

  // 1. التحقق من وجود المفتاح في environment
  if (process.env.COOKIE_ENCRYPTION_KEY) {
    logger.info('✅ Using COOKIE_ENCRYPTION_KEY from environment');
    return process.env.COOKIE_ENCRYPTION_KEY;
  }

  // 2. إذا لم يكن موجوداً، توليد مفتاح جديد وحفظه
  logger.warn('⚠️  COOKIE_ENCRYPTION_KEY not found in environment');
  logger.info('🔑 Generating new encryption key...');

  const newKey = crypto.randomBytes(32).toString('hex');

  try {
    // قراءة محتوى .env.local الحالي
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // إضافة المفتاح الجديد
    if (!envContent.includes('COOKIE_ENCRYPTION_KEY')) {
      const newLine = envContent.endsWith('\n') ? '' : '\n';
      envContent += `${newLine}COOKIE_ENCRYPTION_KEY=${newKey}\n`;

      fs.writeFileSync(envPath, envContent, 'utf8');
      logger.info('✅ COOKIE_ENCRYPTION_KEY saved to .env.local');
      logger.warn('⚠️  IMPORTANT: Backup your .env.local file!');
    }
  } catch (error) {
    logger.error('❌ Failed to save encryption key to .env.local', { error });
    logger.warn('⚠️  WARNING: Encryption key will change on server restart!');
    logger.warn(`⚠️  Please manually add this to .env.local: COOKIE_ENCRYPTION_KEY=${newKey}`);
  }

  return newKey;
}

// الحصول على مفتاح التشفير الثابت
const ENCRYPTION_KEY = getEncryptionKey();

// Validate encryption key
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  const errorMsg = `❌ Invalid ENCRYPTION_KEY length: ${ENCRYPTION_KEY?.length || 0} (expected 64)`;
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

logger.info(`🔑 Encryption key loaded: ${ENCRYPTION_KEY.substring(0, 8)}...`);

let key: Buffer;
try {
  key = Buffer.from(ENCRYPTION_KEY, 'hex');
} catch (error) {
  logger.error('❌ Failed to create key buffer', { error });
  throw error;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.error('❌ Decryption error', { error });
    logger.error('⚠️  This usually happens when:');
    logger.error('   1. COOKIE_ENCRYPTION_KEY changed in environment');
    logger.error('   2. Database was created with a different encryption key');
    logger.error('   3. Encrypted data is corrupted');
    throw new Error('Failed to decrypt data. The encryption key may have changed. Please re-add your accounts.');
  }
}

// ============ Database Helper Functions ============

/**
 * Execute a query with automatic connection handling
 */
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error', { text, params, error });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

/**
 * Initialize database schema
 */
export async function initializeDatabase(): Promise<void> {
  logger.info('🔄 Initializing database schema...');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migrate existing users table to add new columns if they don't exist
    logger.info('🔄 Checking for missing user columns...');
    try {
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`);
      logger.info('✅ User columns migration completed');
    } catch (error) {
      logger.warn('⚠️  User columns migration skipped (columns may already exist)');
    }

    // Subscription Plans Table
    await query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        
        max_accounts INTEGER DEFAULT 1,
        max_dms_per_month INTEGER DEFAULT 100,
        max_follows_per_month INTEGER DEFAULT 50,
        max_active_dm_campaigns INTEGER DEFAULT 1,
        max_active_follow_campaigns INTEGER DEFAULT 1,
        
        is_active BOOLEAN DEFAULT TRUE,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // User Subscriptions Table
    await query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
        
        status VARCHAR(20) DEFAULT 'active',
        subscription_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        subscription_end TIMESTAMP,
        
        dms_used_this_period INTEGER DEFAULT 0,
        follows_used_this_period INTEGER DEFAULT 0,
        period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        period_end TIMESTAMP,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255) NOT NULL,
        handle VARCHAR(255) NOT NULL,
        avatar TEXT,
        encrypted_cookies TEXT NOT NULL,
        is_valid BOOLEAN DEFAULT true,
        last_validated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        target_source VARCHAR(50) NOT NULL,
        message_template TEXT NOT NULL,
        tags TEXT,
        pacing_per_minute INTEGER DEFAULT 3,
        pacing_delay_min INTEGER DEFAULT 15,
        pacing_delay_max INTEGER DEFAULT 30,
        pacing_daily_cap INTEGER DEFAULT 50,
        pacing_retry_attempts INTEGER DEFAULT 2,
        stats_total INTEGER DEFAULT 0,
        stats_sent INTEGER DEFAULT 0,
        stats_failed INTEGER DEFAULT 0,
        stats_replied INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS targets (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        avatar TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP,
        sent_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Add updated_at column if it doesn't exist (migration)
    try {
      await query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    } catch (error) {
      logger.warn('Targets updated_at column migration skipped');
    }
    
    // Change default retry attempts from 2 to 0 (migration)
    try {
      await query(`ALTER TABLE campaigns ALTER COLUMN pacing_retry_attempts SET DEFAULT 0`);
      await query(`ALTER TABLE follow_campaigns ALTER COLUMN pacing_retry_attempts SET DEFAULT 0`);
      
      // Update existing campaigns that have the old default value of 2
      const result1 = await query(`UPDATE campaigns SET pacing_retry_attempts = 0 WHERE pacing_retry_attempts = 2`);
      const result2 = await query(`UPDATE follow_campaigns SET pacing_retry_attempts = 0 WHERE pacing_retry_attempts = 2`);
      
      logger.info(`✓ Updated pacing_retry_attempts: ${result1.rowCount} campaigns, ${result2.rowCount} follow campaigns`);
    } catch (error) {
      logger.warn('Retry attempts migration skipped');
    }

    await query(`
      CREATE TABLE IF NOT EXISTS follow_campaigns (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        target_source VARCHAR(50) NOT NULL,
        tags TEXT,
        pacing_per_minute INTEGER DEFAULT 3,
        pacing_delay_min INTEGER DEFAULT 15,
        pacing_delay_max INTEGER DEFAULT 30,
        pacing_daily_cap INTEGER DEFAULT 50,
        pacing_retry_attempts INTEGER DEFAULT 2,
        stats_total INTEGER DEFAULT 0,
        stats_followed INTEGER DEFAULT 0,
        stats_failed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS follow_targets (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES follow_campaigns(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        avatar TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP,
        followed_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Add updated_at column if it doesn't exist (migration)
    try {
      await query(`ALTER TABLE follow_targets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    } catch (error) {
      logger.warn('Follow_targets updated_at column migration skipped');
    }

    await query(`
      CREATE TABLE IF NOT EXISTS followers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        username VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        profile_url TEXT,
        extracted_from VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, username)
      );
    `);

    // Create indexes for better performance
    await query(`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_targets_campaign_id ON targets(campaign_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_targets_status ON targets(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_follow_campaigns_user_id ON follow_campaigns(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_follow_campaigns_status ON follow_campaigns(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_follow_targets_campaign_id ON follow_targets(campaign_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_follow_targets_status ON follow_targets(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_followers_user_id ON followers(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_followers_account_id ON followers(account_id);`);

    logger.info('✅ Database schema initialized successfully');
    
    // Initialize default data
    await initializeDefaultData();
  } catch (error) {
    logger.error('❌ Failed to initialize database schema', { error });
    throw error;
  }
}

/**
 * Initialize default subscription plans and admin user
 */
async function initializeDefaultData(): Promise<void> {
  try {
    // Check if plans already exist
    const plansResult = await query(`SELECT COUNT(*) FROM subscription_plans`);
    if (parseInt(plansResult.rows[0].count) === 0) {
      logger.info('🔄 Inserting default subscription plans...');

      // Insert Free Plan
      await query(`
        INSERT INTO subscription_plans (name, price, max_accounts, max_dms_per_month, max_follows_per_month, max_active_dm_campaigns, max_active_follow_campaigns, display_order)
        VALUES ('Free', 0, 1, 100, 50, 1, 1, 1)
      `);

      // Insert Starter Plan
      await query(`
        INSERT INTO subscription_plans (name, price, max_accounts, max_dms_per_month, max_follows_per_month, max_active_dm_campaigns, max_active_follow_campaigns, display_order)
        VALUES ('Starter', 29, 3, 1000, 500, 5, 3, 2)
      `);

      // Insert Pro Plan
      await query(`
        INSERT INTO subscription_plans (name, price, max_accounts, max_dms_per_month, max_follows_per_month, max_active_dm_campaigns, max_active_follow_campaigns, display_order)
        VALUES ('Pro', 79, 10, 10000, 5000, 999, 999, 3)
      `);

      logger.info('✅ Default plans created successfully');
    } else {
      logger.info('⏭️  Default plans already exist');
    }

    // Create admin user if doesn't exist (ALWAYS CHECK, NOT INSIDE PLANS CHECK)
    const adminEmail = 'admin@reachly.com';
    const adminResult = await query(`SELECT id FROM users WHERE email = $1`, [adminEmail]);
    
    if (adminResult.rows.length === 0) {
      logger.info('🔄 Creating admin user...');
      const hashedPassword = await bcrypt.hash('Balawi123', 10);
      
      const userResult = await query(`
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [adminEmail, hashedPassword, 'Admin', 'User', 'admin']);
      
      const adminId = userResult.rows[0].id;
      
      // Assign Pro plan to admin
      const proResult = await query(`SELECT id FROM subscription_plans WHERE name = 'Pro'`);
      const proPlanId = proResult.rows[0].id;
      
      await query(`
        INSERT INTO user_subscriptions (user_id, plan_id, status, period_end)
        VALUES ($1, $2, 'active', NOW() + INTERVAL '365 days')
      `, [adminId, proPlanId]);
      
      logger.info('✅ Admin user created successfully');
      logger.info('📧 Admin Email: admin@reachly.com');
      logger.info('🔑 Admin Password: Balawi123');
    }

    // Assign Free plan to all existing users without subscription
    const usersWithoutSub = await query(`
      SELECT u.id FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      WHERE us.id IS NULL AND u.role != 'admin'
    `);

    if (usersWithoutSub.rows.length > 0) {
      logger.info(`🔄 Assigning Free plan to ${usersWithoutSub.rows.length} existing users...`);
      const freeResult = await query(`SELECT id FROM subscription_plans WHERE name = 'Free'`);
      const freePlanId = freeResult.rows[0].id;

      for (const user of usersWithoutSub.rows) {
        await query(`
          INSERT INTO user_subscriptions (user_id, plan_id, status, period_end)
          VALUES ($1, $2, 'active', NOW() + INTERVAL '30 days')
        `, [user.id, freePlanId]);
      }
      
      logger.info('✅ Free plans assigned to existing users');
    }

  } catch (error) {
    logger.error('❌ Failed to initialize default data');
    logger.error('Error details:', error);
    console.error('Full error:', error);
    // Don't throw - this is not critical
  }
}

// Don't initialize on import - let server/index.ts handle it
// This prevents the server from crashing before it starts listening

export default pool;
