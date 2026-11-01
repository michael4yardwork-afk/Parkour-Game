import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import helmet from 'helmet';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { initDb } from './db';
import authRoutes from './routes/auth';
import leaderboardRoutes from './routes/leaderboard';
import communityRoutes from './routes/community';
import usersRoutes from './routes/users';
import raceRoutes from './routes/race';
import billingRoutes from './routes/billing';
import stripeWebhookRoutes from './routes/stripeWebhook';
import { setupWebSocketServer } from './ws';
import { isPaymentLinksConfigured, isStripeConfigured } from './stripe';
import { supabasePublicConfigured } from './supabase';
import { PostgresRateLimitStore } from './rateLimitStore';

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
const isProduction = process.env.NODE_ENV === 'production';

function originFromConfig(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const raw = value.trim();
    return new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`).origin;
  } catch {
    return null;
  }
}

const allowedOrigins = new Set<string>();
for (const value of [
  process.env.APP_URL,
  ...(process.env.ALLOWED_ORIGINS || '').split(','),
  process.env.REPLIT_DEV_DOMAIN,
  ...(process.env.REPLIT_DOMAINS || '').split(','),
]) {
  const origin = originFromConfig(value);
  if (!origin) continue;
  const hostname = new URL(origin).hostname.toLowerCase();
  if (isProduction && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) continue;
  allowedOrigins.add(origin);
}
if (!isProduction) {
  for (const origin of [
    'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5000',
    'http://127.0.0.1:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5000',
  ]) allowedOrigins.add(origin);
}

// Forwarded IP/protocol headers are honored only when the direct peer is an
// explicitly trusted proxy. Do not set Express's broad "trust proxy" flag.
const trustedProxyAddresses = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  ...(process.env.TRUSTED_PROXY_IPS || '').split(',').map(value => value.trim()).filter(Boolean),
]);
app.set('trust proxy', (address: string) => trustedProxyAddresses.has(address));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
}));

log(
  `Starting Delta Rush — PORT=${PORT} NODE_ENV=${process.env.NODE_ENV ?? '(not set)'} ` +
  `DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'NOT SET'} ` +
  `STRIPE_SECRET_KEY=${isStripeConfigured() ? 'set' : 'NOT SET'} ` +
  `STRIPE_WEBHOOK_SECRET=${process.env.STRIPE_WEBHOOK_SECRET ? 'set' : 'NOT SET'} ` +
  `STRIPE_PAYMENT_LINK_MONTHLY=${process.env.STRIPE_PAYMENT_LINK_MONTHLY ? 'set' : 'NOT SET'} ` +
  `STRIPE_PAYMENT_LINK_YEARLY=${process.env.STRIPE_PAYMENT_LINK_YEARLY ? 'set' : 'NOT SET'}`
);

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      return res.status(403).json({ error: 'Origin is not allowed.' });
    }
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(origin ? 204 : 403);
  next();
});

function createRateLimiter(name: string, windowMs: number, limit: number) {
  const rateLimitSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (isProduction && !rateLimitSecret) {
    throw new Error('JWT_SECRET or SESSION_SECRET must be configured for rate-limit keying.');
  }
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new PostgresRateLimitStore(name),
    keyGenerator: req => crypto.createHmac('sha256', rateLimitSecret || 'local-development-only')
      .update(ipKeyGenerator(req.ip || 'unknown'))
      .digest('hex'),
    handler: (_req, res) => res.status(429).json({ error: 'Too many requests. Please try again later.' }),
  });
}

const apiLimiter = createRateLimiter('api', 15 * 60 * 1000, 300);
const loginLimiter = createRateLimiter('auth-login', 15 * 60 * 1000, 10);
const signupLimiter = createRateLimiter('auth-signup', 60 * 60 * 1000, 5);
const recoveryLimiter = createRateLimiter('auth-recovery', 60 * 60 * 1000, 5);
const resetLimiter = createRateLimiter('auth-reset', 15 * 60 * 1000, 10);
const usernameLimiter = createRateLimiter('auth-username', 15 * 60 * 1000, 60);
const dnfLimiter = createRateLimiter('race-dnf', 60 * 1000, 10);

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (req.path === '/billing/webhook') return next();
  return apiLimiter(req, res, next);
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/signup', signupLimiter);
app.use('/api/auth/forgot-password', recoveryLimiter);
app.use('/api/auth/reset-password-supabase', resetLimiter);
app.use('/api/auth/exchange-recovery-token', resetLimiter);
app.use('/api/auth/check-username', usernameLimiter);
app.use('/api/race/dnf', dnfLimiter);

// Stripe webhook must be registered BEFORE express.json() — Stripe's
// signature verification needs the exact raw request body.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhookRoutes);

app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/race', raceRoutes);
app.use('/api/billing', billingRoutes);

app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  port: PORT,
  recovery: {
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseRecoveryConfigured: supabasePublicConfigured,
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    appUrlConfigured: Boolean(process.env.APP_URL && /^https?:\/\/[^/]+\/?$/i.test(process.env.APP_URL.trim())),
    appUrlIsLocalhost: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(process.env.APP_URL || ''),
  },
  billing: {
    stripeSecretConfigured: isStripeConfigured(),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    paymentLinksConfigured: isPaymentLinksConfigured(),
    monthlyPaymentLinkConfigured: Boolean(process.env.STRIPE_PAYMENT_LINK_MONTHLY),
    yearlyPaymentLinkConfigured: Boolean(process.env.STRIPE_PAYMENT_LINK_YEARLY),
  },
}));

app.get('/api/config', (_req, res) => {
  const portalUrl = process.env.STRIPE_CUSTOMER_PORTAL_URL
    || process.env.VITE_STRIPE_CUSTOMER_PORTAL_URL
    || 'https://billing.stripe.com/p/login/3cI14mau09QN8se7TDb7y00';
  res.json({
    stripeCustomerPortalUrl: /^https:\/\/billing\.stripe\.com\/.+/i.test(portalUrl.trim())
      ? portalUrl.trim()
      : '',
  });
});

const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function start() {
  if (!process.env.DATABASE_URL) {
    log('WARNING: DATABASE_URL not set — database features disabled');
  } else {
    try {
      await initDb();
      log('Database initialized.');
    } catch (err: any) {
      log(`Database init failed (server still running): ${err.stack ?? err}`);
    }
  }

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

}

start().catch((err) => {
  log(`Fatal startup error: ${err?.stack ?? err}`);
  // Do NOT exit — keep the process alive so Hostinger sees it running
});
