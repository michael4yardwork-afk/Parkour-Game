import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db';
import authRoutes from './routes/auth';
import leaderboardRoutes from './routes/leaderboard';
import communityRoutes from './routes/community';
import usersRoutes from './routes/users';
import { setupWebSocketServer } from './ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

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

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// In production, serve the built React frontend from dist/
if (IS_PROD) {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  // SPA fallback — any unmatched route returns index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function start() {
  try {
    await initDb();
    console.log('Database initialized.');
    setupWebSocketServer(httpServer);
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Delta Rush API running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
