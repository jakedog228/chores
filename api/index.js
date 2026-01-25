import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from '../server/routes/auth.js';
import { apiRouter } from '../server/routes/api.js';
import { requireAuth } from '../server/middleware/auth.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api', requireAuth, apiRouter);

// Export for Vercel
export default app;
