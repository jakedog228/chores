import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/api.js';
import { requireAuth } from './middleware/auth.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api', requireAuth, apiRouter);
  return app;
}
