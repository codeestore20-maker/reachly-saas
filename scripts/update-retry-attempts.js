// Script to update existing campaigns with retry_attempts = 2 to 0
// Run this once to fix old campaigns

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateRetryAttempts() {
  try {
    console.log('🔄 Updating campaigns with retry_attempts = 2 to 0...');
    
    const result1 = await pool.query(`
      UPDATE campaigns 
      SET pacing_retry_attempts = 0 
      WHERE pacing_retry_attempts = 2
    `);
    
    console.log(`✓ Updated ${result1.rowCount} campaigns`);
    
    const result2 = await pool.query(`
      UPDATE follow_campaigns 
      SET pacing_retry_attempts = 0 
      WHERE pacing_retry_attempts = 2
    `);
    
    console.log(`✓ Updated ${result2.rowCount} follow campaigns`);
    console.log('✅ Done!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateRetryAttempts();
