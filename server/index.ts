import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { initDb } from './db';
import authRoutes from './routes/auth';
import leaderboardRoutes from './routes/leaderboard';
import communityRoutes from './routes/community';
import usersRoutes from './routes/users';
import billingRoutes from './routes/billing';
import stripeWebhookRoutes from './routes/stripeWebhook';
import { setupWebSocketServer } from './ws';
import { isStripeConfigured } from './stripe';

// ── Diagnostics: write crash info to startup.log so it is readable
// ── from Hostinger's file manager even when console is inaccessible
const logPath = path.join(process.cwd(), 'startup.log');
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(logPath, line); } catch {}
}

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack ?? err.message}`);
});
process.on('unhandledRejection', (reason: any) => {
  log(`UNHANDLED REJECTION: ${reason?.stack ?? reason}`);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT) || 3001;

log(
  `Starting Delta Rush — PORT=${PORT} NODE_ENV=${process.env.NODE_ENV ?? '(not set)'} ` +
  `DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'NOT SET'} ` +
  `STRIPE_SECRET_KEY=${isStripeConfigured() ? 'set' : 'NOT SET'} ` +
  `STRIPE_WEBHOOK_SECRET=${process.env.STRIPE_WEBHOOK_SECRET ? 'set' : 'NOT SET'} ` +
  `STRIPE_PRICE_MONTHLY=${process.env.STRIPE_PRICE_MONTHLY ? 'set' : 'NOT SET'} ` +
  `STRIPE_PRICE_YEARLY=${process.env.STRIPE_PRICE_YEARLY ? 'set' : 'NOT SET'}`
);

// Stripe webhook must be registered BEFORE express.json() — Stripe's
// signature verification needs the exact raw request body.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhookRoutes);

app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/billing', billingRoutes);

app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  port: PORT,
  billing: {
    stripeSecretConfigured: isStripeConfigured(),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    monthlyPriceConfigured: Boolean(process.env.STRIPE_PRICE_MONTHLY),
    yearlyPriceConfigured: Boolean(process.env.STRIPE_PRICE_YEARLY),
  },
}));

const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function start() {
  setupWebSocketServer(httpServer);

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', (err) => {
      log(`HTTP server error: ${(err as any).stack ?? err}`);
      reject(err);
    });
    httpServer.listen(PORT, '0.0.0.0', () => {
      httpServer.removeListener('error', reject as any);
      log(`Server listening on http://0.0.0.0:${PORT}`);
      resolve();
    });
  });

  if (!process.env.DATABASE_URL) {
    log('WARNING: DATABASE_URL not set — database features disabled');
    return;
  }
  try {
    await initDb();
    log('Database initialized.');
  } catch (err: any) {
    log(`Database init failed (server still running): ${err.stack ?? err}`);
  }
}

start().catch((err) => {
  log(`Fatal startup error: ${err?.stack ?? err}`);
  // Do NOT exit — keep the process alive so Hostinger sees it running
});
