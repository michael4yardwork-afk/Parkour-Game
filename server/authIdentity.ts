import { Request } from 'express';
import jwt from 'jsonwebtoken';
import pool from './db';

export interface AuthenticatedAccount {
  id: number;
  username: string;
  email: string | null;
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || '';

export function getVerifiedToken(req: Request): jwt.JwtPayload & { username?: string } | null {
  if (!JWT_SECRET) return null;

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;

  try {
    return jwt.verify(authorization.slice('Bearer '.length), JWT_SECRET) as jwt.JwtPayload & {
      username?: string;
    };
  } catch {
    return null;
  }
}

export function signAuthToken(account: { id: number; username: string }): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET or SESSION_SECRET must be configured.');
  }
  return jwt.sign(
    { sub: String(account.id), username: account.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export async function getAuthenticatedAccount(req: Request): Promise<AuthenticatedAccount | null> {
  const decoded = getVerifiedToken(req);
  if (!decoded) return null;

  if (typeof decoded.sub === 'string' && /^\d+$/.test(decoded.sub)) {
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [Number(decoded.sub)]
    );
    return result.rows[0] ?? null;
  }

  // Legacy tokens are accepted only after cryptographic verification and are
  // resolved against the current database account.
  if (typeof decoded.username === 'string' && decoded.username.length > 0) {
    const result = await pool.query(
      `SELECT id, username, email
       FROM users
       WHERE LOWER(username) = LOWER($1)`,
      [decoded.username]
    );
    return result.rows[0] ?? null;
  }

  return null;
}