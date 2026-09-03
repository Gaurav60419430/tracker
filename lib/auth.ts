import { createHmac, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { findUserById } from './db/store';

export const COOKIE = 'mt_session';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.AUTH_SECRET?.trim() || 'money-tees-dev-secret-change-in-prod';
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateCredentials(input: { userId?: string; password?: string }): { username: string; displayName: string; password: string } | { error: string } {
  const rawUser = (input.userId ?? '').trim();
  const password = input.password ?? '';
  if (!rawUser || rawUser.length < 3 || rawUser.length > 24) return { error: 'User ID must be 3–24 characters' };
  if (!/^[a-zA-Z0-9_]+$/.test(rawUser)) return { error: 'User ID: letters, numbers and _ only' };
  if (!password || password.length < 4 || password.length > 72) return { error: 'Password must be 4–72 characters' };
  return { username: normalizeUsername(rawUser), displayName: rawUser, password };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// Stateless signed token: base64url(userId.expiry.signature)
// No sessions table needed — works on free Turso + Workers + Vercel.
export function createToken(userId: string): string {
  const expiry = Date.now() + THIRTY_DAYS_MS;
  const payload = `${userId}.${expiry}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [userId, expiryStr, sig] = decoded.split('.');
    if (!userId || !expiryStr || !sig) return null;
    const expiry = Number(expiryStr);
    if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
    const expected = createHmac('sha256', getSecret()).update(`${userId}.${expiry}`).digest('hex');
    if (sig.length !== expected.length) return null;
    // constant-time-ish compare
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return null;
    return { userId };
  } catch {
    return null;
  }
}

export type SessionUser = { id: string; username: string; displayName: string };

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const parsed = verifyToken(token);
  if (!parsed) return null;
  try {
    const row = await findUserById(parsed.userId);
    if (!row) return null;
    return { id: row.id, username: row.username, displayName: row.displayName };
  } catch {
    return null;
  }
}

export function newUserId(): string {
  return randomBytes(16).toString('hex');
}
