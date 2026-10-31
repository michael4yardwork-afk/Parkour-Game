import { Request } from 'express';
import jwt from 'jsonwebtoken';
import pool from './db';

export interface AuthenticatedAccount {
  id: number;
  username: string;
  email: string | null;
  tokenVersion: number;
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || '';
const ACCESS_TOKEN_LIFETIME = '7d';

export type VerifiedAuthToken = jwt.JwtPayload & {
  username?: string;
  ver?: number;
};

export function verifyAuthToken(token: string): VerifiedAuthToken | null {
  if (!JWT_SECRET) return null;
  if (typeof token !== 'string' || token.length > 8192) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: ACCESS_TOKEN_LIFETIME,
    }) as VerifiedAuthToken;
    if (
      typeof decoded.sub !== 'string' ||
      !/^\d+$/.test(decoded.sub) ||
      !Number.isSafeInteger(Number(decoded.sub)) ||
      typeof decoded.username !== 'string' ||
      decoded.username.length < 3 ||
      decoded.username.length > 32 ||
      (decoded.ver !== undefined && (!Number.isSafeInteger(decoded.ver) || decoded.ver < 0))
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function getVerifiedToken(req: Request): VerifiedAuthToken | null {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return verifyAuthToken(authorization.slice('Bearer '.length));
}

export function signAuthToken(account: { id: number; username: string; tokenVersion?: number }): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET or SESSION_SECRET must be configured.');
  }
  return jwt.sign(
    { sub: String(account.id), username: account.username, ver: account.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_LIFETIME, algorithm: 'HS256' }
  );
}

export async function getAuthenticatedAccountFromToken(token: string): Promise<AuthenticatedAccount | null> {
  const decoded = verifyAuthToken(token);
  if (!decoded) return null;

  const result = await pool.query(
    `SELECT id, username, email, token_version
     FROM users
     WHERE id = $1`,
    [Number(decoded.sub)]
  );
  const row = result.rows[0];
  if (!row || (decoded.ver ?? 0) !== Number(row.token_version ?? 0)) return null;
  if (decoded.username?.toLowerCase() !== String(row.username).toLowerCase()) return null;

  return {
    id: row.id,
    username: row.username,
    email: row.email ?? null,
    tokenVersion: Number(row.token_version ?? 0),
  };
}

export async function getAuthenticatedAccount(req: Request): Promise<AuthenticatedAccount | null> {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return getAuthenticatedAccountFromToken(authorization.slice('Bearer '.length));
}