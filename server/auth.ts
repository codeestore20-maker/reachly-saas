import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db-postgres';
import logger from './logger';

// JWT Secret - يجب أن يكون موجود في environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('❌ FATAL: JWT_SECRET environment variable is required');
  throw new Error('JWT_SECRET environment variable is required');
}

export interface User {
  id: number;
  email: string;
  role?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: User): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET!, { expiresIn: '7d' });
}

export function verifyToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as any;
    return { id: decoded.id, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

export async function createUser(email: string, passwordHash: string): Promise<number> {
  try {
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash]
    );
    return result.rows[0].id;
  } catch (error) {
    logger.error('Failed to create user', { email, error });
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<any> {
  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get user by email', { email, error });
    throw error;
  }
}

export async function getUserById(id: number): Promise<any> {
  try {
    const result = await query('SELECT id, email FROM users WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get user by id', { id, error });
    throw error;
  }
}
