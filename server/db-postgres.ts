import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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
console.log('🔍 DEBUG: Validating encryption key...');
console.log(`🔍 DEBUG: Key length: ${ENCRYPTION_KEY?.length || 0}`);
console.log(`🔍 DEBUG: Key preview: ${ENCRYPTION_KEY?.substring(0, 16)}...`);

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  const errorMsg = `❌ Invalid ENCRYPTION_KEY length: ${ENCRYPTION_KEY?.length || 0} (expected 64)`;
  console.error(errorMsg);
  logger.error(errorMsg);
  logger.error('⚠️  Generating new valid key...');
  throw new Error('Invalid encryption key. Please check COOKIE_ENCRYPTION_KEY in environment variables.');
}

console.log('✅ Encryption key is valid!');
logger.info(`🔑 Encryption key loaded: ${ENCRYPTION_KEY.substring(0, 8)}...`);

let key: Buffer;
try {
  key = Buffer.from(ENCRYPTION_KEY, 'hex');
  console.log('✅ Key buffer created successfully');
} catch (error) {
  console.error('❌ Failed to create key buffer:', error);
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    await query(`CREATE INDEX IF NOT EXISTS idx_follow_targets_campaign_id ON follow_targets(campaign_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_follow_targets_status ON follow_targets(status);`);

    logger.info('✅ Database schema initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize database schema', { error });
    throw error;
  }
}

// Don't initialize on import - let server/index.ts handle it
// This prevents the server from crashing before it starts listening

export default pool;
