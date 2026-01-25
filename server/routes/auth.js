import { Router } from 'express';
import { argon2id, argon2Verify } from 'hash-wasm';
import crypto from 'crypto';
import {
  getAuthConfig,
  saveAuthConfig,
  getRateLimitAttempts,
  recordLoginAttempt
} from '../storage.js';
import {
  generateToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie
} from '../middleware/auth.js';

export const authRouter = Router();

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return await argon2id({
    password,
    salt,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded'
  });
}

async function verifyPassword(hash, password) {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}

authRouter.get('/status', async (req, res) => {
  const config = await getAuthConfig();
  const token = req.cookies.cc_session;

  let authenticated = false;
  if (token) {
    const payload = await verifyToken(token);
    authenticated = !!payload;
  }

  res.json({
    needsSetup: !config.passwordHash,
    authenticated
  });
});

authRouter.post('/setup', async (req, res) => {
  const config = await getAuthConfig();

  if (config.passwordHash) {
    return res.status(403).json({ error: 'Password already configured' });
  }

  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters' });
  }

  const passwordHash = await hashPassword(password);
  const secret = crypto.randomBytes(64).toString('base64');

  await saveAuthConfig({ passwordHash, secret });

  const token = await generateToken();
  setAuthCookie(res, token);

  res.json({ success: true });
});

authRouter.post('/login', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const rateLimit = await getRateLimitAttempts(ip);

  if (rateLimit.blockedUntil && Date.now() < rateLimit.blockedUntil) {
    const remainingSeconds = Math.ceil((rateLimit.blockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: 'Too many failed attempts',
      retryAfter: remainingSeconds
    });
  }

  const config = await getAuthConfig();

  if (!config.passwordHash) {
    return res.status(400).json({ error: 'Password not configured. Please run setup first.' });
  }

  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  const valid = await verifyPassword(config.passwordHash, password);

  if (!valid) {
    await recordLoginAttempt(ip, false);

    const newRateLimit = await getRateLimitAttempts(ip);
    if (newRateLimit.blockedUntil) {
      const remainingSeconds = Math.ceil((newRateLimit.blockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: 'Too many failed attempts',
        retryAfter: remainingSeconds
      });
    }

    return res.status(401).json({ error: 'Invalid password' });
  }

  await recordLoginAttempt(ip, true);
  const token = await generateToken();
  setAuthCookie(res, token);

  res.json({ success: true });
});

authRouter.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});
