import * as jose from 'jose';
import { getAuthConfig } from '../storage.js';

const TOKEN_COOKIE = 'cc_session';
const TOKEN_EXPIRY = '180d';

async function getSecret() {
  const config = await getAuthConfig();
  if (!config.secret) {
    return null;
  }
  return new TextEncoder().encode(config.secret);
}

export async function generateToken() {
  const secret = await getSecret();
  if (!secret) throw new Error('No secret configured');

  const token = await new jose.SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);

  return token;
}

export async function verifyToken(token) {
  const secret = await getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res, token) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 180 * 24 * 60 * 60 * 1000 // 6 months
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
}

export async function requireAuth(req, res, next) {
  const token = req.cookies[TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  next();
}
